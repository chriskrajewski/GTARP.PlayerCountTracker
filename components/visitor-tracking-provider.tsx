'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { usePathname } from 'next/navigation';
import { logger } from '@/lib/logger';
import { useFeatureFlag, FEATURE_FLAGS } from '@/lib/feature-flags';

/**
 * Visitor Tracking Provider Component
 * 
 * Comprehensive tracking system that captures:
 * - Session creation with full device/browser/OS detection
 * - Page views on route changes
 * - Performance metrics (Web Vitals)
 * - JavaScript errors
 * - User interactions (clicks, form submissions, scroll depth)
 * 
 * This component must be mounted at the root level to track all pages.
 * Sessions persist across route changes using localStorage.
 */

interface VisitorSession {
  sessionId: string;
  createdAt: Date;
  lastActivityAt: Date;
}

interface BrowserInfo {
  name: string | null;
  version: string | null;
  engine: string | null;
}

interface OSInfo {
  name: string | null;
  version: string | null;
}

interface DeviceInfo {
  type: 'desktop' | 'mobile' | 'tablet' | 'unknown';
  screenResolution: string;
  viewportSize: string;
}

interface ConnectionInfo {
  type: string | null;
  effectiveType: string | null;
  downlink: number | null;
  rtt: number | null;
}

const SESSION_STORAGE_KEY = 'gtarp_visitor_session_id';
const SESSION_CREATED_KEY = 'gtarp_visitor_session_created';
const SESSION_INIT_FLAG = 'gtarp_session_initializing';
const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24; // 24 hours

/**
 * Parse user agent to extract browser and OS information
 */
function parseUserAgent(userAgent: string): { browser: BrowserInfo; os: OSInfo; device: DeviceInfo } {
  const browser: BrowserInfo = { name: null, version: null, engine: null };
  const os: OSInfo = { name: null, version: null };
  const device: DeviceInfo = {
    type: 'unknown',
    screenResolution: `${window.screen.width}x${window.screen.height}`,
    viewportSize: `${window.innerWidth}x${window.innerHeight}`
  };

  // Browser detection
  if (userAgent.includes('Chrome') && !userAgent.includes('Chromium')) {
    browser.name = 'Chrome';
    browser.engine = 'Blink';
    const match = userAgent.match(/Chrome\/(\d+)/);
    if (match) browser.version = match[1];
  } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
    browser.name = 'Safari';
    browser.engine = 'WebKit';
    const match = userAgent.match(/Version\/(\d+)/);
    if (match) browser.version = match[1];
  } else if (userAgent.includes('Firefox')) {
    browser.name = 'Firefox';
    browser.engine = 'Gecko';
    const match = userAgent.match(/Firefox\/(\d+)/);
    if (match) browser.version = match[1];
  } else if (userAgent.includes('Edge')) {
    browser.name = 'Edge';
    browser.engine = 'Blink';
    const match = userAgent.match(/Edg\/(\d+)/);
    if (match) browser.version = match[1];
  } else if (userAgent.includes('Opera') || userAgent.includes('OPR')) {
    browser.name = 'Opera';
    browser.engine = 'Blink';
    const match = userAgent.match(/OPR\/(\d+)/);
    if (match) browser.version = match[1];
  }

  // OS detection
  if (userAgent.includes('Windows')) {
    os.name = 'Windows';
    const match = userAgent.match(/Windows NT ([\d.]+)/);
    if (match) {
      const version = match[1];
      if (version === '10.0') os.version = '10';
      else if (version === '6.3') os.version = '8.1';
      else if (version === '6.2') os.version = '8';
      else os.version = version;
    }
  } else if (userAgent.includes('Mac OS X')) {
    os.name = 'macOS';
    const match = userAgent.match(/Mac OS X ([\d_]+)/);
    if (match) os.version = match[1].replace(/_/g, '.');
  } else if (userAgent.includes('Linux')) {
    os.name = 'Linux';
  } else if (userAgent.includes('iPhone')) {
    os.name = 'iOS';
    device.type = 'mobile';
    const match = userAgent.match(/OS ([\d_]+)/);
    if (match) os.version = match[1].replace(/_/g, '.');
  } else if (userAgent.includes('iPad')) {
    os.name = 'iOS';
    device.type = 'tablet';
    const match = userAgent.match(/OS ([\d_]+)/);
    if (match) os.version = match[1].replace(/_/g, '.');
  } else if (userAgent.includes('Android')) {
    os.name = 'Android';
    device.type = userAgent.includes('Tablet') ? 'tablet' : 'mobile';
    const match = userAgent.match(/Android ([\d.]+)/);
    if (match) os.version = match[1];
  }

  // Device type detection
  if (device.type === 'unknown') {
    if (window.innerWidth < 768) {
      device.type = 'mobile';
    } else if (window.innerWidth < 1024) {
      device.type = 'tablet';
    } else {
      device.type = 'desktop';
    }
  }

  return { browser, os, device };
}

/**
 * Get connection information
 */
function getConnectionInfo(): ConnectionInfo {
  const nav = navigator as any;
  const connection = nav.connection || nav.mozConnection || nav.webkitConnection;

  return {
    type: connection?.type || null,
    effectiveType: connection?.effectiveType || null,
    downlink: connection?.downlink || null,
    rtt: connection?.rtt || null
  };
}

/**
 * Get UTM parameters from URL
 */
function getUTMParameters(): Record<string, string | null> {
  const params = new URLSearchParams(window.location.search);
  return {
    utm_source: params.get('utm_source'),
    utm_medium: params.get('utm_medium'),
    utm_campaign: params.get('utm_campaign'),
    utm_content: params.get('utm_content'),
    utm_term: params.get('utm_term')
  };
}

export function VisitorTrackingProvider() {
  const trackingEnabled = useFeatureFlag(FEATURE_FLAGS.VISITOR_TRACKING);
  const sessionRef = useRef<VisitorSession | null>(null);
  const pageViewStartTimeRef = useRef<number>(0);
  const scrollDepthRef = useRef<number>(0);
  const clickCountRef = useRef<number>(0);
  const formInteractionsRef = useRef<number>(0);
  const [isMounted, setIsMounted] = useState(false);
  const pathname = usePathname();
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const initializationRef = useRef<boolean>(false); // Track if initialization has started
  const isFirstPageView = useRef<boolean>(true); // Track first page view

  /**
   * Initialize tracking on mount (only once, ever)
   */
  useEffect(() => {
    setIsMounted(true);
  }, []);

  /**
   * Create or get session and setup tracking (ONLY ONCE)
   */
  useEffect(() => {
    if (!isMounted || initializationRef.current) return;
    if (!trackingEnabled) return;

    // Mark as initializing to prevent duplicate calls
    initializationRef.current = true;

    let cleanupFunctions: Array<() => void> = [];

    const initializeTracking = async () => {
      try {
        // Check if we're already initializing (race condition protection)
        const isInitializing = sessionStorage.getItem(SESSION_INIT_FLAG);
        if (isInitializing === 'true') {
          logger.warn('Already initializing, skipping duplicate initialization');
          return;
        }

        // Set initialization flag
        sessionStorage.setItem(SESSION_INIT_FLAG, 'true');

        // Check for existing session in localStorage
        let storedSessionId = localStorage.getItem(SESSION_STORAGE_KEY);
        const createdAt = localStorage.getItem(SESSION_CREATED_KEY);

        let sessionId: string;
        let shouldTrackPageView = true;

        if (storedSessionId && createdAt) {
          const createdAtTime = Date.parse(createdAt);
          const sessionAgeMs = Date.now() - createdAtTime;
          if (Number.isFinite(createdAtTime) && sessionAgeMs > SESSION_MAX_AGE_MS) {
            logger.info('Stored visitor session expired locally, creating new one', { sessionAgeMs });
            localStorage.removeItem(SESSION_STORAGE_KEY);
            localStorage.removeItem(SESSION_CREATED_KEY);
            storedSessionId = null;
          }
        }

        if (storedSessionId && createdAt) {
          // Validate and reactivate existing session via heartbeat
          // This ensures the session exists and is marked as active
          try {
            const heartbeatResponse = await fetch('/api/visitors/heartbeat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ session_id: storedSessionId })
            });

            // Handle different response scenarios
            if (heartbeatResponse.ok) {
              // Session is valid and now active
              sessionId = storedSessionId;
              sessionRef.current = {
                sessionId: storedSessionId,
                createdAt: new Date(createdAt),
                lastActivityAt: new Date()
              };
              logger.info('Reusing existing session', { sessionId: storedSessionId });
              
              // Check if this is a page refresh (same URL) to avoid duplicate page views
              const lastTrackedPage = sessionStorage.getItem('gtarp_last_tracked_page');
              const lastTrackedTime = sessionStorage.getItem('gtarp_last_tracked_time');
              const currentPage = window.location.pathname;
              const now = Date.now();
              
              // Skip page view if same page was tracked within last 5 seconds (refresh detection)
              if (lastTrackedPage === currentPage && lastTrackedTime) {
                const timeSinceLastTrack = now - parseInt(lastTrackedTime, 10);
                if (timeSinceLastTrack < 5000) {
                  shouldTrackPageView = false;
                  logger.debug('Skipping duplicate page view on refresh', { 
                    currentPage, 
                    timeSinceLastTrack 
                  });
                }
              }
            } else if (heartbeatResponse.status === 429) {
              // Rate limited - assume session is still valid, don't create new one
              logger.warn('Heartbeat rate limited, assuming session is valid');
              sessionId = storedSessionId;
              sessionRef.current = {
                sessionId: storedSessionId,
                createdAt: new Date(createdAt),
                lastActivityAt: new Date()
              };
              // Skip page view tracking when rate limited to avoid further issues
              shouldTrackPageView = false;
            } else if (heartbeatResponse.status === 404) {
              // Session doesn't exist in database, create new one
              logger.info('Session not found in database, creating new session');
              localStorage.removeItem(SESSION_STORAGE_KEY);
              localStorage.removeItem(SESSION_CREATED_KEY);
              sessionId = await createNewSession();
              if (!sessionId) {
                throw new Error('Failed to create new session');
              }
            } else {
              // Other error - try to reuse session anyway to avoid creating duplicates
              logger.warn('Heartbeat returned error, attempting to reuse session', { 
                status: heartbeatResponse.status 
              });
              sessionId = storedSessionId;
              sessionRef.current = {
                sessionId: storedSessionId,
                createdAt: new Date(createdAt),
                lastActivityAt: new Date()
              };
            }
          } catch (heartbeatError) {
            // Network error - assume session is still valid to avoid creating duplicates
            logger.warn('Heartbeat network error, assuming session is valid', heartbeatError);
            sessionId = storedSessionId;
            sessionRef.current = {
              sessionId: storedSessionId,
              createdAt: new Date(createdAt),
              lastActivityAt: new Date()
            };
          }
        } else {
          // Create new session
          sessionId = await createNewSession();
          if (!sessionId) {
            throw new Error('Failed to create new session');
          }
        }

        // Helper function to create a new session
        async function createNewSession(): Promise<string | null> {
          logger.info('Creating new session');
          const userAgent = navigator.userAgent;
          const { browser, os, device } = parseUserAgent(userAgent);
          const connection = getConnectionInfo();
          const utm = getUTMParameters();

          const sessionData = {
            device_type: device.type,
            browser_name: browser.name,
            browser_version: browser.version,
            os_name: os.name,
            os_version: os.version,
            screen_resolution: device.screenResolution,
            viewport_size: device.viewportSize,
            connection_type: connection.type,
            connection_speed_mbps: connection.downlink,
            language: navigator.language,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            referrer: document.referrer || null,
            landing_page: window.location.pathname,
            utm_source: utm.utm_source,
            utm_medium: utm.utm_medium,
            utm_campaign: utm.utm_campaign,
            utm_content: utm.utm_content,
            utm_term: utm.utm_term
          };

          const response = await fetch('/api/visitors/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sessionData)
          });

          if (!response.ok) {
            throw new Error(`Session creation failed: ${response.statusText}`);
          }

          const data = await response.json();
          const newSessionId = data.session_id;

          sessionRef.current = {
            sessionId: newSessionId,
            createdAt: new Date(),
            lastActivityAt: new Date()
          };

          // Store session ID in localStorage
          localStorage.setItem(SESSION_STORAGE_KEY, newSessionId);
          localStorage.setItem(SESSION_CREATED_KEY, new Date().toISOString());

          logger.info('New visitor session created', {
            sessionId: newSessionId,
            browser: browser.name,
            os: os.name,
            device: device.type
          });

          return newSessionId;
        }

        // Setup error tracking
        const handleError = (event: ErrorEvent) => {
          fetch('/api/visitors/error', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              session_id: sessionId,
              error_type: 'error',
              error_message: event.message,
              error_stack: event.error?.stack || null,
              page_url: window.location.pathname,
              user_agent: navigator.userAgent
            })
          }).catch(err => logger.error('Failed to track error', err));
        };

        const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
          fetch('/api/visitors/error', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              session_id: sessionId,
              error_type: 'error',
              error_message: `Unhandled Promise Rejection: ${event.reason}`,
              error_stack: null,
              page_url: window.location.pathname,
              user_agent: navigator.userAgent
            })
          }).catch(err => logger.error('Failed to track error', err));
        };

        window.addEventListener('error', handleError);
        window.addEventListener('unhandledrejection', handleUnhandledRejection);
        cleanupFunctions.push(() => {
          window.removeEventListener('error', handleError);
          window.removeEventListener('unhandledrejection', handleUnhandledRejection);
        });

        // Setup scroll tracking
        const handleScroll = () => {
          const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
          const scrolled = window.scrollY;
          const scrollPercent = scrollHeight > 0 ? Math.round((scrolled / scrollHeight) * 100) : 0;
          if (scrollPercent > scrollDepthRef.current) {
            scrollDepthRef.current = scrollPercent;
          }
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        cleanupFunctions.push(() => window.removeEventListener('scroll', handleScroll));

        // Setup click tracking
        const handleClick = () => {
          clickCountRef.current++;
        };
        document.addEventListener('click', handleClick);
        cleanupFunctions.push(() => document.removeEventListener('click', handleClick));

        // Setup form tracking
        const handleChange = (event: Event) => {
          if (
            event.target instanceof HTMLInputElement ||
            event.target instanceof HTMLSelectElement ||
            event.target instanceof HTMLTextAreaElement
          ) {
            formInteractionsRef.current++;
          }
        };
        document.addEventListener('change', handleChange);
        cleanupFunctions.push(() => document.removeEventListener('change', handleChange));

        // Track initial page view (skip if this is a page refresh)
        pageViewStartTimeRef.current = Date.now();
        if (shouldTrackPageView) {
          await fetch('/api/visitors/page-view', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              session_id: sessionId,
              page_url: window.location.pathname,
              page_title: document.title,
              referrer: document.referrer || null
            })
          }).catch(err => logger.error('Failed to track page view', err));
          
          // Store tracking info in sessionStorage to detect refreshes
          sessionStorage.setItem('gtarp_last_tracked_page', window.location.pathname);
          sessionStorage.setItem('gtarp_last_tracked_time', Date.now().toString());
        }

        // Track performance metrics
        const trackPerformance = () => {
          setTimeout(async () => {
            try {
              const perfData = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
              if (!perfData) return;

              const fcp = performance.getEntriesByName('first-contentful-paint')[0];
              const lcp = performance.getEntriesByType('largest-contentful-paint').pop();

              let cls = 0;
              const clsEntries = performance.getEntriesByType('layout-shift');
              clsEntries.forEach((entry: any) => {
                if (!entry.hadRecentInput) {
                  cls += entry.value;
                }
              });

              await fetch('/api/visitors/performance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  session_id: sessionId,
                  page_url: window.location.pathname,
                  page_load_time_ms: Math.round(perfData.loadEventEnd - perfData.fetchStart),
                  first_contentful_paint_ms: fcp ? Math.round(fcp.startTime) : null,
                  largest_contentful_paint_ms: lcp ? Math.round(lcp.startTime) : null,
                  cumulative_layout_shift: Math.round(cls * 1000) / 1000,
                  time_to_interactive_ms: Math.round(perfData.domInteractive - perfData.fetchStart),
                  dom_content_loaded_ms: Math.round(perfData.domContentLoadedEventEnd - perfData.fetchStart),
                  window_load_ms: Math.round(perfData.loadEventEnd - perfData.fetchStart)
                })
              });
            } catch (err) {
              logger.error('Failed to track performance', err);
            }
          }, 100);
        };

        if (document.readyState === 'loading') {
          window.addEventListener('load', trackPerformance);
        } else {
          trackPerformance();
        }

        let isRecreatingSession = false;

        const recreateSession = async () => {
          if (isRecreatingSession) {
            return;
          }
          isRecreatingSession = true;
          try {
            logger.info('Recreating visitor session after missing heartbeat', { sessionId });
            localStorage.removeItem(SESSION_STORAGE_KEY);
            localStorage.removeItem(SESSION_CREATED_KEY);
            const newSessionId = await createNewSession();
            if (newSessionId) {
              sessionId = newSessionId;
            } else {
              throw new Error('Failed to recreate visitor session');
            }
          } catch (err) {
            logger.error('Failed to recreate visitor session after heartbeat 404', err);
          } finally {
            isRecreatingSession = false;
          }
        };

        const sendHeartbeat = async () => {
          if (!sessionId) {
            return;
          }

          try {
            const response = await fetch('/api/visitors/heartbeat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ session_id: sessionId })
            });

            if (response.status === 404) {
              await recreateSession();
            } else if (!response.ok) {
              logger.warn('Heartbeat request failed', { status: response.status });
            }
          } catch (err) {
            logger.error('Failed to send heartbeat', err);
          }
        };

        // Setup heartbeat (every 30 seconds)
        heartbeatIntervalRef.current = setInterval(() => {
          sendHeartbeat();
        }, 30000);

        // Clear initialization flag after a delay
        setTimeout(() => {
          sessionStorage.removeItem(SESSION_INIT_FLAG);
        }, 1000);

      } catch (error) {
        logger.error('Failed to initialize tracking', error);
        sessionStorage.removeItem(SESSION_INIT_FLAG);
      }
    };

    initializeTracking();

    return () => {
      cleanupFunctions.forEach(cleanup => cleanup());
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    };
  }, [isMounted]);

  /**
   * Track page view on route change (but not on initial mount)
   */
  useEffect(() => {
    if (!isMounted || !sessionRef.current) return;
    if (!trackingEnabled) return;

    // Skip first page view (already tracked in initialization)
    if (isFirstPageView.current) {
      isFirstPageView.current = false;
      return;
    }

    // Track subsequent page views
    pageViewStartTimeRef.current = Date.now();
    scrollDepthRef.current = 0;
    clickCountRef.current = 0;
    formInteractionsRef.current = 0;

    fetch('/api/visitors/page-view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionRef.current.sessionId,
        page_url: pathname,
        page_title: document.title,
        referrer: document.referrer || null
      })
    }).catch(err => logger.error('Failed to track page view on route change', err));

    logger.debug('Page view tracked on route change', { pathname });
  }, [pathname, isMounted]);

  return null;
}

'use client';

import { useEffect, useRef, useCallback } from 'react';

/**
 * Visitor Tracking Library
 * 
 * Comprehensive tracking for visitor behavior, performance, and events
 * Source: Enhanced Visitor Tracking System
 */

interface TrackingConfig {
  sessionId: string;
  enabled?: boolean;
  trackPageViews?: boolean;
  trackPerformance?: boolean;
  trackErrors?: boolean;
}

class VisitorTracker {
  private sessionId: string;
  private enabled: boolean;
  private trackPageViews: boolean;
  private trackPerformance: boolean;
  private trackErrors: boolean;
  private pageViewStartTime: number = 0;
  private scrollDepth: number = 0;
  private clickCount: number = 0;
  private formInteractions: number = 0;

  constructor(config: TrackingConfig) {
    this.sessionId = config.sessionId;
    this.enabled = config.enabled !== false;
    this.trackPageViews = config.trackPageViews !== false;
    this.trackPerformance = config.trackPerformance !== false;
    this.trackErrors = config.trackErrors !== false;

    if (this.enabled && this.trackErrors) {
      this.setupErrorTracking();
    }
  }

  /**
   * Track page view
   */
  async trackPageView(options?: {
    pageUrl?: string;
    pageTitle?: string;
    referrer?: string;
  }) {
    if (!this.enabled || !this.trackPageViews) return;

    this.pageViewStartTime = Date.now();
    this.clickCount = 0;
    this.formInteractions = 0;
    this.scrollDepth = 0;

    try {
      await fetch('/api/visitors/page-view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: this.sessionId,
          page_url: options?.pageUrl || window.location.pathname,
          page_title: options?.pageTitle || document.title,
          referrer: options?.referrer || document.referrer,
        })
      });
    } catch (error) {
      console.error('Failed to track page view:', error);
    }
  }

  /**
   * Track custom event
   */
  async trackEvent(eventType: string, eventData?: {
    name?: string;
    value?: string;
    category?: string;
    label?: string;
    customData?: Record<string, any>;
  }) {
    if (!this.enabled) return;

    try {
      await fetch('/api/visitors/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: this.sessionId,
          event_type: eventType,
          event_name: eventData?.name || null,
          event_value: eventData?.value || null,
          event_category: eventData?.category || null,
          event_label: eventData?.label || null,
          page_url: window.location.pathname,
          custom_data: eventData?.customData || null,
        })
      });
    } catch (error) {
      console.error('Failed to track event:', error);
    }
  }

  /**
   * Track conversion
   */
  async trackConversion(conversionType: string, conversionData?: {
    value?: number;
    currency?: string;
    details?: Record<string, any>;
  }) {
    if (!this.enabled) return;

    try {
      await fetch('/api/visitors/conversion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: this.sessionId,
          conversion_type: conversionType,
          conversion_value: conversionData?.value || null,
          conversion_currency: conversionData?.currency || 'USD',
          page_url: window.location.pathname,
          conversion_details: conversionData?.details || null,
        })
      });
    } catch (error) {
      console.error('Failed to track conversion:', error);
    }
  }

  /**
   * Track JavaScript error
   */
  private async trackError(errorMessage: string, errorStack?: string) {
    if (!this.enabled || !this.trackErrors) return;

    try {
      await fetch('/api/visitors/error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: this.sessionId,
          error_type: 'error',
          error_message: errorMessage,
          error_stack: errorStack || null,
          page_url: window.location.pathname,
          user_agent: navigator.userAgent,
        })
      });
    } catch (error) {
      console.error('Failed to track error:', error);
    }
  }

  /**
   * Setup error tracking
   */
  private setupErrorTracking() {
    window.addEventListener('error', (event) => {
      this.trackError(
        event.message,
        event.error?.stack || undefined
      );
    });

    window.addEventListener('unhandledrejection', (event) => {
      this.trackError(
        `Unhandled Promise Rejection: ${event.reason}`,
        undefined
      );
    });
  }

  /**
   * Track performance metrics
   */
  async trackPerformance() {
    if (!this.enabled || !this.trackPerformance) return;

    // Wait for page to fully load
    if (document.readyState === 'loading') {
      window.addEventListener('load', () => this.sendPerformanceMetrics());
    } else {
      this.sendPerformanceMetrics();
    }
  }

  /**
   * Send performance metrics
   */
  private async sendPerformanceMetrics() {
    try {
      const perfData = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      
      if (!perfData) return;

      // Get Web Vitals
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
          session_id: this.sessionId,
          page_url: window.location.pathname,
          page_load_time_ms: Math.round(perfData.loadEventEnd - perfData.fetchStart),
          first_contentful_paint_ms: fcp ? Math.round(fcp.startTime) : null,
          largest_contentful_paint_ms: lcp ? Math.round(lcp.startTime) : null,
          cumulative_layout_shift: Math.round(cls * 1000) / 1000,
          time_to_interactive_ms: Math.round(perfData.domInteractive - perfData.fetchStart),
          dom_content_loaded_ms: Math.round(perfData.domContentLoadedEventEnd - perfData.fetchStart),
          window_load_ms: Math.round(perfData.loadEventEnd - perfData.fetchStart),
        })
      });
    } catch (error) {
      console.error('Failed to track performance:', error);
    }
  }

  /**
   * Track scroll depth
   */
  setupScrollTracking() {
    if (!this.enabled) return;

    window.addEventListener('scroll', () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrolled = window.scrollY;
      const scrollPercent = scrollHeight > 0 ? Math.round((scrolled / scrollHeight) * 100) : 0;
      
      if (scrollPercent > this.scrollDepth) {
        this.scrollDepth = scrollPercent;
      }
    });
  }

  /**
   * Track clicks
   */
  setupClickTracking() {
    if (!this.enabled) return;

    document.addEventListener('click', () => {
      this.clickCount++;
    });
  }

  /**
   * Track form interactions
   */
  setupFormTracking() {
    if (!this.enabled) return;

    document.addEventListener('change', (event) => {
      if (event.target instanceof HTMLInputElement || 
          event.target instanceof HTMLSelectElement || 
          event.target instanceof HTMLTextAreaElement) {
        this.formInteractions++;
      }
    });
  }

  /**
   * Get current metrics
   */
  getMetrics() {
    return {
      scrollDepth: this.scrollDepth,
      clickCount: this.clickCount,
      formInteractions: this.formInteractions,
      timeOnPage: Math.round((Date.now() - this.pageViewStartTime) / 1000),
    };
  }
}

/**
 * React Hook for Visitor Tracking
 */
export function useVisitorTracking(sessionId: string, config?: Partial<TrackingConfig>) {
  const trackerRef = useRef<VisitorTracker | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    trackerRef.current = new VisitorTracker({
      sessionId,
      ...config,
    });

    // Setup tracking
    trackerRef.current.setupScrollTracking();
    trackerRef.current.setupClickTracking();
    trackerRef.current.setupFormTracking();

    // Track initial page view
    trackerRef.current.trackPageView();

    // Track performance
    trackerRef.current.trackPerformance();

    return () => {
      // Cleanup if needed
    };
  }, [sessionId, config]);

  const trackEvent = useCallback((eventType: string, eventData?: any) => {
    trackerRef.current?.trackEvent(eventType, eventData);
  }, []);

  const trackConversion = useCallback((conversionType: string, conversionData?: any) => {
    trackerRef.current?.trackConversion(conversionType, conversionData);
  }, []);

  const getMetrics = useCallback(() => {
    return trackerRef.current?.getMetrics();
  }, []);

  return {
    trackEvent,
    trackConversion,
    getMetrics,
  };
}

/**
 * Standalone tracker instance
 */
export function createVisitorTracker(config: TrackingConfig) {
  return new VisitorTracker(config);
}

"use client";

import { useEffect, useState } from 'react';

/**
 * Hook to register and manage the service worker for PWA support
 * Handles offline functionality and caching for the admin panel
 */
export function useServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check if service workers are supported
    if (!('serviceWorker' in navigator)) {
      console.warn('Service Workers are not supported in this browser');
      return;
    }

    const registerServiceWorker = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none',
        });

        console.info('Service Worker registered successfully:', registration);

        // Check for updates periodically
        setInterval(() => {
          registration.update();
        }, 60000); // Check every minute

        // Handle service worker updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New service worker is ready
              console.info('New Service Worker version available');
              
              // Notify user about update (optional)
              if (typeof window !== 'undefined') {
                window.dispatchEvent(
                  new CustomEvent('sw-update-available', {
                    detail: { registration },
                  })
                );
              }
            }
          });
        });

        // Handle controller change
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          console.info('Service Worker controller changed');
        });
      } catch (error) {
        console.error('Failed to register Service Worker:', error);
      }
    };

    // Register service worker after a short delay to ensure page is loaded
    const timeout = setTimeout(registerServiceWorker, 1000);

    return () => clearTimeout(timeout);
  }, []);
}

/**
 * Hook to check if app is running as PWA
 */
export function useIsPWA() {
  const [isPWA, setIsPWA] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check if running as PWA
    const isStandalone =
      (window.navigator as any).standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches;

    setIsPWA(isStandalone);
  }, []);

  return isPWA;
}

/**
 * Hook to handle offline/online status
 */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Set initial status
    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

/**
 * Hook to cache admin pages for offline access
 */
export function useCacheAdminPages() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    const cachePages = async () => {
      const adminPages = [
        '/admin',
        '/admin/visitors',
        '/admin/data',
        '/admin/notifications',
        '/admin/settings',
      ];

      for (const page of adminPages) {
        if (navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: 'CACHE_ADMIN_PAGE',
            url: page,
          });
        }
      }
    };

    // Cache pages after service worker is ready
    if (navigator.serviceWorker.ready) {
      navigator.serviceWorker.ready.then(cachePages);
    }
  }, []);
}


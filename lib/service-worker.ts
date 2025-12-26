/**
 * Service Worker Registration Module
 * 
 * Handles service worker registration and lifecycle management.
 * Enables offline support and caching strategies.
 */

export interface ServiceWorkerConfig {
  enabled?: boolean;
  cacheName?: string;
  cacheVersion?: string;
  maxCacheSize?: number;
}

const DEFAULT_CONFIG: ServiceWorkerConfig = {
  enabled: true,
  cacheName: 'gtarp-pct-cache',
  cacheVersion: 'v1',
  maxCacheSize: 50 * 1024 * 1024, // 50MB
};

/**
 * Register service worker
 */
export async function registerServiceWorker(
  config: ServiceWorkerConfig = {}
): Promise<ServiceWorkerRegistration | null> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  if (!finalConfig.enabled) {
    console.debug('Service Worker is disabled');
    return null;
  }

  if (typeof window === 'undefined') {
    console.debug('Service Worker registration skipped (server-side)');
    return null;
  }

  if (!('serviceWorker' in navigator)) {
    console.warn('Service Workers are not supported in this browser');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });

    console.info('Service Worker registered successfully', {
      scope: registration.scope,
    });

    // Handle updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          console.info('New Service Worker available, update ready');
          // Notify user about update
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

    return registration;
  } catch (error) {
    console.error('Service Worker registration failed:', error);
    return null;
  }
}

/**
 * Unregister service worker
 */
export async function unregisterServiceWorker(): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return false;
  }

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    const results = await Promise.all(
      registrations.map((registration) => registration.unregister())
    );
    console.info('Service Worker unregistered');
    return results.some((result) => result);
  } catch (error) {
    console.error('Service Worker unregistration failed:', error);
    return false;
  }
}

/**
 * Check if service worker is active
 */
export function isServiceWorkerActive(): boolean {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return false;
  }

  return !!navigator.serviceWorker.controller;
}

/**
 * Send message to service worker
 */
export function postMessageToServiceWorker(message: any): void {
  if (!isServiceWorkerActive()) {
    console.warn('Service Worker is not active');
    return;
  }

  navigator.serviceWorker.controller?.postMessage(message);
}

/**
 * Listen for messages from service worker
 */
export function onServiceWorkerMessage(
  callback: (event: MessageEvent) => void
): () => void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return () => {};
  }

  navigator.serviceWorker.addEventListener('message', callback);

  return () => {
    navigator.serviceWorker.removeEventListener('message', callback);
  };
}

/**
 * Update event - handle service worker updates
 */
export async function skipWaitingServiceWorker(): Promise<void> {
  if (!isServiceWorkerActive()) {
    return;
  }

  postMessageToServiceWorker({ type: 'SKIP_WAITING' });
}

/**
 * Clear service worker cache
 */
export async function clearServiceWorkerCache(
  cacheName?: string
): Promise<boolean> {
  if (typeof window === 'undefined' || !('caches' in window)) {
    return false;
  }

  try {
    const cacheNames = await caches.keys();
    const namesToDelete = cacheName
      ? cacheNames.filter((name) => name === cacheName)
      : cacheNames;

    const results = await Promise.all(
      namesToDelete.map((name) => caches.delete(name))
    );

    console.info('Service Worker cache cleared', { count: results.length });
    return results.some((result) => result);
  } catch (error) {
    console.error('Failed to clear Service Worker cache:', error);
    return false;
  }
}

/**
 * Get service worker cache size
 */
export async function getServiceWorkerCacheSize(): Promise<number> {
  if (typeof window === 'undefined' || !('storage' in navigator)) {
    return 0;
  }

  try {
    const estimate = await navigator.storage.estimate();
    return estimate.usage || 0;
  } catch (error) {
    console.error('Failed to get cache size:', error);
    return 0;
  }
}

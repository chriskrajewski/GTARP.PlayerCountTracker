/* eslint-disable no-undef */
/* global self, caches, fetch, Request, Response, URL, FetchEvent, ExtendableEvent, ExtendableMessageEvent */

/**
 * Service Worker
 * 
 * Handles offline support, caching strategies, and background sync.
 * Implements cache-first strategy for static assets and network-first for API calls.
 * Optimized for PWA and mobile app support.
 */

const CACHE_NAME = 'gtarp-pct-cache-v2';
const ADMIN_CACHE_NAME = 'gtarp-admin-cache-v1';
const STATIC_ASSETS = [
  '/',
  '/admin',
  '/placeholder-logo.png',
  '/placeholder-logo.svg',
  '/placeholder.jpg',
  '/placeholder.svg',
  '/pepeRP.webp',
  // iOS PWA icons - Critical for home screen display
  '/apple-touch-icon.png',
  '/apple-touch-icon-precomposed.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-152.png',
  '/icons/icon-144.png',
  '/manifest.json'
];

/**
 * Install event - cache static assets
 */
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE_NAME);
        await cache.addAll(STATIC_ASSETS);
        console.info('Service Worker installed and static assets cached');
        // Skip waiting to activate immediately
        self.skipWaiting();
      } catch (error) {
        console.error('Failed to cache static assets:', error);
      }
    })()
  );
});

/**
 * Activate event - clean up old caches
 */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cacheNames = await caches.keys();
        const cachesToDelete = cacheNames.filter(
          (name) => name !== CACHE_NAME && name !== ADMIN_CACHE_NAME
        );

        await Promise.all(
          cachesToDelete.map((name) => {
            console.info('Deleting old cache:', name);
            return caches.delete(name);
          })
        );

        // Claim all clients
        await self.clients.claim();
        console.info('Service Worker activated');
      } catch (error) {
        console.error('Failed to activate Service Worker:', error);
      }
    })()
  );
});

/**
 * External domains that should bypass service worker caching
 * These are CDNs for Twitch/Kick images and media that may have CORS/CSP issues
 */
const EXTERNAL_IMAGE_DOMAINS = [
  'static-cdn.jtvnw.net',
  'clips-media-assets2.twitch.tv',
  'clips-media-assets.twitch.tv',
  'images.kick.com',
  'files.kick.com',
  'clips.kick.com',
  'player.kick.com',
  'cdn.7tv.app',
];

/**
 * Check if URL is from an external image CDN
 */
function isExternalImageCDN(hostname) {
  return EXTERNAL_IMAGE_DOMAINS.some(domain => hostname.includes(domain));
}

/**
 * Fetch event - implement caching strategies
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome extensions and other non-http(s) requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Skip external image CDNs - let browser handle these directly to avoid CSP issues
  if (isExternalImageCDN(url.hostname)) {
    return;
  }

  // Auth endpoints - skip service worker entirely, let browser handle it
  if (url.pathname.includes('/api/admin/auth')) {
    return;
  }

  // Admin routes - use admin cache
  if (url.pathname.startsWith('/admin')) {
    event.respondWith(adminCacheStrategy(request));
    return;
  }

  // API requests - network first, fallback to cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstStrategy(request));
    return;
  }

  // Static assets - cache first, fallback to network (only for same-origin)
  if (isStaticAsset(url.pathname) && url.origin === self.location.origin) {
    event.respondWith(cacheFirstStrategy(request));
    return;
  }

  // Default - network first
  event.respondWith(networkFirstStrategy(request));
});

/**
 * Message event - handle messages from clients
 */
self.addEventListener('message', (event) => {
  const { type } = event.data;

  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
    case 'CLEAR_CACHE':
      event.waitUntil(clearAllCaches());
      break;
    case 'GET_CACHE_SIZE':
      event.waitUntil(
        (async () => {
          const size = await getCacheSize();
          event.ports[0].postMessage({ size });
        })()
      );
      break;
    case 'CACHE_ADMIN_PAGE':
      event.waitUntil(cacheAdminPage(event.data.url));
      break;
    default:
      console.debug('Unknown message type:', type);
  }
});

/**
 * Admin cache strategy - optimized for admin panel
 */
async function adminCacheStrategy(request) {
  try {
    const cache = await caches.open(ADMIN_CACHE_NAME);
    
    // Try network first for admin pages
    try {
      const response = await fetch(request);
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    } catch (networkError) {
      // Fall back to cache
      const cached = await cache.match(request);
      if (cached) {
        return cached;
      }
      
      // Return offline page for admin
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Offline - Admin panel data unavailable',
          offline: true
        }),
        {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  } catch (error) {
    console.error('Admin cache strategy failed:', error);
    return new Response('Service Unavailable', { status: 503 });
  }
}

/**
 * Cache-first strategy: try cache first, fallback to network
 */
async function cacheFirstStrategy(request) {
  try {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);

    if (cached) {
      return cached;
    }

    const response = await fetch(request);

    if (response.ok) {
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    console.error('Cache-first strategy failed:', error);
    return new Response('Offline - Resource not available', {
      status: 503,
      statusText: 'Service Unavailable',
    });
  }
}

/**
 * Network-first strategy: try network first, fallback to cache
 * @param {Request} request - The fetch request
 * @param {boolean} alwaysFresh - If true, don't cache the response (for auth endpoints)
 */
async function networkFirstStrategy(request, alwaysFresh = false) {
  try {
    const response = await fetch(request);

    if (response.ok && !alwaysFresh) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    console.debug('Network request failed, trying cache:', error);

    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);

    if (cached) {
      return cached;
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Offline - Unable to fetch data',
      }),
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

/**
 * Check if URL is a static asset
 */
function isStaticAsset(pathname) {
  const staticExtensions = [
    '.js',
    '.css',
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.svg',
    '.webp',
    '.woff',
    '.woff2',
    '.ttf',
    '.eot',
  ];

  return staticExtensions.some((ext) => pathname.endsWith(ext));
}

/**
 * Cache admin page for offline access
 */
async function cacheAdminPage(url) {
  try {
    const cache = await caches.open(ADMIN_CACHE_NAME);
    const response = await fetch(url);
    if (response.ok) {
      await cache.put(url, response);
    }
  } catch (error) {
    console.error('Failed to cache admin page:', error);
  }
}

/**
 * Clear all caches
 */
async function clearAllCaches() {
  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map((name) => caches.delete(name)));
  console.info('All caches cleared');
}

/**
 * Get total cache size
 */
async function getCacheSize() {
  const cacheNames = await caches.keys();
  let totalSize = 0;

  for (const name of cacheNames) {
    const cache = await caches.open(name);
    const keys = await cache.keys();

    for (const request of keys) {
      const response = await cache.match(request);
      if (response) {
        const blob = await response.blob();
        totalSize += blob.size;
      }
    }
  }

  return totalSize;
}

/* ========================================================================== */
/* Web Push notifications (R3.4, R3.9)                                        */
/* ========================================================================== */
/*
 * These handlers ADD web-push support on top of the caching logic above; they
 * do not modify any of the existing install/activate/fetch/message behavior.
 *
 * The server (lib/web-push.ts) delivers a VAPID-signed push whose data is the
 * JSON payload `{ title, body, url?, icon? }`. The `push` handler shows that
 * notification (with a generic fallback if the payload can't be parsed), and
 * `notificationclick` focuses an existing client or opens the deep link.
 */

/* global Notification, clients */

const DEFAULT_NOTIFICATION_ICON = '/icons/icon-192.png';
const DEFAULT_NOTIFICATION_TITLE = 'RPStats';
const DEFAULT_NOTIFICATION_BODY = 'You have a new notification.';

/**
 * Push event - show a notification from the server payload.
 * Falls back to a generic notification if the payload is missing or not valid
 * JSON, rather than throwing (R3.9 resilience).
 */
self.addEventListener('push', (event) => {
  let payload = {};

  if (event.data) {
    try {
      payload = event.data.json();
    } catch (error) {
      // Malformed/expired payload - show a generic notification instead of failing.
      console.debug('Push payload was not valid JSON, using fallback:', error);
      try {
        payload = { body: event.data.text() };
      } catch {
        payload = {};
      }
    }
  }

  const title = (payload && payload.title) || DEFAULT_NOTIFICATION_TITLE;
  const options = {
    body: (payload && payload.body) || DEFAULT_NOTIFICATION_BODY,
    icon: (payload && payload.icon) || DEFAULT_NOTIFICATION_ICON,
    badge: DEFAULT_NOTIFICATION_ICON,
    data: {
      url: (payload && payload.url) || '/',
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

/**
 * Notification click - focus an existing client on the target URL if one is
 * open, otherwise open a new window to the deep link in `notification.data.url`.
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    (async () => {
      const allClients = await clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      // Prefer focusing an already-open client; navigate it to the target URL.
      for (const client of allClients) {
        if ('focus' in client) {
          try {
            if ('navigate' in client) {
              await client.navigate(targetUrl);
            }
          } catch {
            // Navigation can fail for cross-origin clients; focus regardless.
          }
          return client.focus();
        }
      }

      // No open client - open a new window to the deep link.
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }

      return undefined;
    })()
  );
});

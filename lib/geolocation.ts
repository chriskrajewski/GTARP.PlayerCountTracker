/**
 * IP Geolocation Utility
 * 
 * Provides server-side IP geolocation for visitor tracking.
 * Uses ip-api.com free tier (no API key required, 45 requests/minute limit).
 * 
 * For production with higher traffic, consider:
 * - MaxMind GeoIP2 (local database, no rate limits)
 * - IPinfo.io (100k free requests/month)
 * - Cloudflare headers (if using Cloudflare)
 */

import { logger } from '@/lib/logger';

export interface GeoLocation {
  country: string | null;      // Country name (e.g., "United States")
  countryCode: string | null;  // ISO 3166-1 alpha-2 (e.g., "US")
  region: string | null;       // Region/State name (e.g., "California")
  regionCode: string | null;   // Region code (e.g., "CA")
  city: string | null;         // City name (e.g., "San Francisco")
  latitude: number | null;     // Latitude
  longitude: number | null;    // Longitude
  timezone: string | null;     // Timezone (e.g., "America/Los_Angeles")
  isp: string | null;          // ISP name
  org: string | null;          // Organization name
}

interface IpApiResponse {
  status: 'success' | 'fail';
  message?: string;
  country?: string;
  countryCode?: string;
  region?: string;
  regionName?: string;
  city?: string;
  lat?: number;
  lon?: number;
  timezone?: string;
  isp?: string;
  org?: string;
}

// Simple in-memory cache to reduce API calls
// Key: IP address, Value: { data: GeoLocation, timestamp: number }
const geoCache = new Map<string, { data: GeoLocation; timestamp: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_CACHE_SIZE = 10000; // Maximum cache entries

/**
 * Clean up old cache entries
 */
function cleanupCache(): void {
  const now = Date.now();
  let cleaned = 0;
  
  for (const [key, value] of geoCache.entries()) {
    if (now - value.timestamp > CACHE_TTL_MS) {
      geoCache.delete(key);
      cleaned++;
    }
  }
  
  // If still too large, remove oldest entries
  if (geoCache.size > MAX_CACHE_SIZE) {
    const entries = Array.from(geoCache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    const toRemove = entries.slice(0, geoCache.size - MAX_CACHE_SIZE);
    for (const [key] of toRemove) {
      geoCache.delete(key);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    logger.debug(`Geolocation cache cleanup: removed ${cleaned} entries`);
  }
}

/**
 * Extract real client IP from request headers
 * Handles various proxy configurations (Vercel, Cloudflare, nginx, etc.)
 * 
 * @param headers Request headers
 * @returns Client IP address or null
 */
export function extractClientIp(headers: Headers): string | null {
  // Priority order for IP extraction:
  // 1. Cloudflare's CF-Connecting-IP (most reliable if using Cloudflare)
  // 2. X-Forwarded-For (standard proxy header, take first IP - most common)
  // 3. Vercel's x-vercel-forwarded-for
  // 4. X-Real-IP (nginx, some load balancers - but often set to proxy IP)
  
  const cfConnectingIp = headers.get('cf-connecting-ip');
  if (cfConnectingIp && !isPrivateIp(cfConnectingIp.trim())) {
    return cfConnectingIp.trim();
  }
  
  // X-Forwarded-For is the most reliable for getting the original client IP
  // Format: "client, proxy1, proxy2" - first IP is the original client
  const xForwardedFor = headers.get('x-forwarded-for');
  if (xForwardedFor) {
    const firstIp = xForwardedFor.split(',')[0]?.trim();
    if (firstIp && !isPrivateIp(firstIp)) {
      return firstIp;
    }
  }
  
  const vercelForwardedFor = headers.get('x-vercel-forwarded-for');
  if (vercelForwardedFor) {
    const firstIp = vercelForwardedFor.split(',')[0]?.trim();
    if (firstIp && !isPrivateIp(firstIp)) {
      return firstIp;
    }
  }
  
  // X-Real-IP is often set by proxies to their own IP, so check it last
  const xRealIp = headers.get('x-real-ip');
  if (xRealIp && !isPrivateIp(xRealIp.trim())) {
    return xRealIp.trim();
  }
  
  // If all headers contain private IPs, return the first X-Forwarded-For IP anyway
  // (useful for logging/debugging even if we can't geolocate)
  if (xForwardedFor) {
    const firstIp = xForwardedFor.split(',')[0]?.trim();
    if (firstIp) {
      return firstIp;
    }
  }
  
  return null;
}

/**
 * Check if an IP address is private/local (not geolocatable)
 * 
 * @param ip IP address to check
 * @returns true if private/local IP
 */
function isPrivateIp(ip: string): boolean {
  // IPv4 private ranges
  if (
    ip.startsWith('10.') ||
    ip.startsWith('192.168.') ||
    ip.startsWith('127.') ||
    ip.startsWith('172.16.') ||
    ip.startsWith('172.17.') ||
    ip.startsWith('172.18.') ||
    ip.startsWith('172.19.') ||
    ip.startsWith('172.20.') ||
    ip.startsWith('172.21.') ||
    ip.startsWith('172.22.') ||
    ip.startsWith('172.23.') ||
    ip.startsWith('172.24.') ||
    ip.startsWith('172.25.') ||
    ip.startsWith('172.26.') ||
    ip.startsWith('172.27.') ||
    ip.startsWith('172.28.') ||
    ip.startsWith('172.29.') ||
    ip.startsWith('172.30.') ||
    ip.startsWith('172.31.') ||
    ip === 'localhost' ||
    ip === '::1'
  ) {
    return true;
  }
  
  // IPv6 private/local
  if (ip.startsWith('fe80:') || ip.startsWith('fc00:') || ip.startsWith('fd00:')) {
    return true;
  }
  
  return false;
}

/**
 * Get geolocation data for an IP address
 * Uses ip-api.com free service with caching
 * 
 * @param ip IP address to geolocate
 * @returns GeoLocation data or null values if lookup fails
 */
export async function getGeoLocation(ip: string | null): Promise<GeoLocation> {
  const emptyResult: GeoLocation = {
    country: null,
    countryCode: null,
    region: null,
    regionCode: null,
    city: null,
    latitude: null,
    longitude: null,
    timezone: null,
    isp: null,
    org: null,
  };
  
  if (!ip) {
    logger.debug('No IP address provided for geolocation');
    return emptyResult;
  }
  
  // Skip private/local IPs
  if (isPrivateIp(ip)) {
    logger.debug('Skipping geolocation for private IP', { ip });
    return emptyResult;
  }
  
  // Check cache first
  const cached = geoCache.get(ip);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    logger.debug('Geolocation cache hit', { ip });
    return cached.data;
  }
  
  try {
    // Use ip-api.com free tier
    // Documentation: https://ip-api.com/docs/api:json
    // Fields: country, countryCode, region, regionName, city, lat, lon, timezone, isp, org
    const response = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,message,country,countryCode,region,regionName,city,lat,lon,timezone,isp,org`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        // 5 second timeout
        signal: AbortSignal.timeout(5000),
      }
    );
    
    if (!response.ok) {
      logger.warn('Geolocation API returned non-OK status', { 
        ip, 
        status: response.status 
      });
      return emptyResult;
    }
    
    const data: IpApiResponse = await response.json();
    
    if (data.status !== 'success') {
      logger.warn('Geolocation lookup failed', { 
        ip, 
        message: data.message 
      });
      return emptyResult;
    }
    
    const result: GeoLocation = {
      country: data.country || null,
      countryCode: data.countryCode || null,
      region: data.regionName || null,
      regionCode: data.region || null,
      city: data.city || null,
      latitude: data.lat ?? null,
      longitude: data.lon ?? null,
      timezone: data.timezone || null,
      isp: data.isp || null,
      org: data.org || null,
    };
    
    // Cache the result
    geoCache.set(ip, { data: result, timestamp: Date.now() });
    
    // Periodic cache cleanup
    if (geoCache.size > MAX_CACHE_SIZE * 0.9) {
      cleanupCache();
    }
    
    logger.debug('Geolocation lookup successful', { 
      ip, 
      country: result.country, 
      city: result.city 
    });
    
    return result;
  } catch (error) {
    // Handle timeout or network errors gracefully
    if (error instanceof Error) {
      if (error.name === 'TimeoutError' || error.name === 'AbortError') {
        logger.warn('Geolocation lookup timed out', { ip });
      } else {
        logger.warn('Geolocation lookup error', { ip, error: error.message });
      }
    }
    return emptyResult;
  }
}

/**
 * Get geolocation from request headers
 * Convenience function that extracts IP and performs lookup
 * 
 * @param headers Request headers
 * @returns GeoLocation data
 */
export async function getGeoLocationFromHeaders(headers: Headers): Promise<GeoLocation> {
  const ip = extractClientIp(headers);
  return getGeoLocation(ip);
}

/**
 * Get cache statistics for monitoring
 */
export function getGeoCacheStats(): { size: number; maxSize: number } {
  return {
    size: geoCache.size,
    maxSize: MAX_CACHE_SIZE,
  };
}

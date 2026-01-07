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
 * Handles various proxy configurations (Azure Front Door, Cloudflare, nginx, etc.)
 * 
 * @param headers Request headers
 * @returns Client IP address or null
 */
export function extractClientIp(headers: Headers): string | null {
  // Normalize IP strings to strip ports/IPv6 wrappers
  const normalizeIp = (ip: string | null | undefined): string | null => {
    if (!ip) {
      return null;
    }
    let normalized = ip.trim();
    
    if (!normalized) {
      return null;
    }
    
    // Remove IPv4-mapped IPv6 prefix
    if (normalized.startsWith('::ffff:')) {
      normalized = normalized.substring(7);
    }
    
    // Remove brackets for IPv6 with ports ([2001:db8::1]:1234)
    if (normalized.startsWith('[')) {
      const closingIndex = normalized.indexOf(']');
      if (closingIndex !== -1) {
        normalized = normalized.substring(1, closingIndex);
      }
    }
    
    // Remove port for IPv4 with :port
    if (normalized.includes(':') && normalized.includes('.')) {
      normalized = normalized.split(':')[0] ?? normalized;
    }
    
    // Remove zone identifiers (e.g., fe80::1%eth0)
    if (normalized.includes('%')) {
      normalized = normalized.split('%')[0] ?? normalized;
    }
    
    return normalized || null;
  };
  
  const getFirstListIp = (value: string | null): string | null => {
    if (!value) {
      return null;
    }
    const first = value.split(',')[0]?.trim();
    return normalizeIp(first);
  };
  
  const parseForwardedHeader = (value: string | null): string | null => {
    if (!value) {
      return null;
    }
    
    // Only examine the first forwarded component
    const first = value.split(',')[0];
    const match = /for=([^;]+)/i.exec(first);
    if (!match || !match[1]) {
      return null;
    }
    
    // Remove surrounding quotes if present
    const candidate = match[1].replace(/"/g, '').trim();
    return normalizeIp(candidate);
  };
  
  // Priority order for IP extraction, covering common proxy providers
  const headerChecks: Array<() => string | null> = [
    () => normalizeIp(headers.get('cf-connecting-ip')),
    () => normalizeIp(headers.get('x-azure-clientip')),
    () => normalizeIp(headers.get('x-arr-clientip')),
    () => normalizeIp(headers.get('x-client-ip')),
    () => normalizeIp(headers.get('x-clientip')),
    () => normalizeIp(headers.get('true-client-ip')),
    () => normalizeIp(headers.get('x-ms-client-ip')),
    () => normalizeIp(headers.get('x-ms-original-forwarded-for')),
    () => getFirstListIp(headers.get('x-forwarded-for')),
    () => getFirstListIp(headers.get('x-original-forwarded-for')),
    () => getFirstListIp(headers.get('x-vercel-forwarded-for')),
    () => normalizeIp(headers.get('x-real-ip')),
    () => parseForwardedHeader(headers.get('forwarded')),
  ];
  
  for (const getIp of headerChecks) {
    const ip = getIp();
    if (ip && !isPrivateIp(ip)) {
      return ip;
    }
  }
  
  // As a fallback, return the first forward header even if private for debugging
  const fallback = getFirstListIp(headers.get('x-forwarded-for')) ?? normalizeIp(headers.get('x-real-ip'));
  if (fallback) {
    return fallback;
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

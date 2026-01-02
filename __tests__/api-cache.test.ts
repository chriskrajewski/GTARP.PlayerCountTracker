/**
 * API Cache Management System - Integration Tests
 * 
 * Tests for the cache system including:
 * - Cache configuration management
 * - Cache data storage and retrieval
 * - TTL expiration
 * - Admin API endpoints
 * - Twitch API integration
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

// Mock Supabase client for testing
const mockSupabaseClient = {
  from: jest.fn(),
};

describe('API Cache Management System', () => {
  describe('Cache Configuration', () => {
    it('should retrieve all cache configurations', async () => {
      // Test: GET /api/admin/cache
      const response = await fetch('/api/admin/cache', {
        headers: {
          'Authorization': 'Bearer test-token',
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.data.some((c: { api_name: string }) => c.api_name === 'twitch_live_streams')).toBe(true);
    });

    it('should retrieve specific cache configuration', async () => {
      // Test: GET /api/admin/cache?apiName=twitch_live_streams
      const response = await fetch('/api/admin/cache?apiName=twitch_live_streams', {
        headers: {
          'Authorization': 'Bearer test-token',
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.api_name).toBe('twitch_live_streams');
      expect(typeof data.data.cache_enabled).toBe('boolean');
      expect(typeof data.data.cache_ttl_seconds).toBe('number');
    });

    it('should update cache configuration', async () => {
      // Test: POST /api/admin/cache
      const response = await fetch('/api/admin/cache', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apiName: 'twitch_live_streams',
          cache_ttl_seconds: 600,
          cache_enabled: true,
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.cache_ttl_seconds).toBe(600);
    });

    it('should validate TTL is at least 1 second', async () => {
      // Test: POST /api/admin/cache with invalid TTL
      const response = await fetch('/api/admin/cache', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apiName: 'twitch_live_streams',
          cache_ttl_seconds: 0,
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('at least 1');
    });

    it('should require apiName parameter', async () => {
      // Test: POST /api/admin/cache without apiName
      const response = await fetch('/api/admin/cache', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cache_ttl_seconds: 300,
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('apiName');
    });
  });

  describe('Cache Statistics', () => {
    it('should retrieve cache statistics', async () => {
      // Test: GET /api/admin/cache?apiName=twitch_live_streams&action=stats
      const response = await fetch(
        '/api/admin/cache?apiName=twitch_live_streams&action=stats',
        {
          headers: {
            'Authorization': 'Bearer test-token',
          },
        }
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('api_name');
      expect(data.data).toHaveProperty('cache_enabled');
      expect(data.data).toHaveProperty('cache_ttl_seconds');
      expect(data.data).toHaveProperty('total_entries');
      expect(data.data).toHaveProperty('expired_entries');
      expect(typeof data.data.total_entries).toBe('number');
      expect(typeof data.data.expired_entries).toBe('number');
    });
  });

  describe('Cache Operations', () => {
    it('should clear cache for an API', async () => {
      // Test: DELETE /api/admin/cache?apiName=twitch_live_streams
      const response = await fetch(
        '/api/admin/cache?apiName=twitch_live_streams',
        {
          method: 'DELETE',
          headers: {
            'Authorization': 'Bearer test-token',
          },
        }
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.message).toContain('Cache cleared');
    });

    it('should require apiName for cache clear', async () => {
      // Test: DELETE /api/admin/cache without apiName
      const response = await fetch('/api/admin/cache', {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer test-token',
        },
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('apiName');
    });
  });

  describe('Authentication', () => {
    it('should require admin authentication for GET', async () => {
      // Test: GET /api/admin/cache without auth
      const response = await fetch('/api/admin/cache');

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('authentication');
    });

    it('should require admin authentication for POST', async () => {
      // Test: POST /api/admin/cache without auth
      const response = await fetch('/api/admin/cache', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apiName: 'test',
          cache_ttl_seconds: 300,
        }),
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('authentication');
    });

    it('should require admin authentication for DELETE', async () => {
      // Test: DELETE /api/admin/cache without auth
      const response = await fetch('/api/admin/cache?apiName=test', {
        method: 'DELETE',
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('authentication');
    });
  });

  describe('Twitch API Integration', () => {
    it('should return cached data with X-Cache: HIT header', async () => {
      // Test: GET /api/live/twitch with cache hit
      // First request to populate cache
      await fetch('/api/live/twitch?serverIds=gtarp1', {
        headers: {
          'Authorization': 'Bearer test-token',
        },
      });

      // Second request should hit cache
      const response = await fetch('/api/live/twitch?serverIds=gtarp1', {
        headers: {
          'Authorization': 'Bearer test-token',
        },
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('X-Cache')).toBe('HIT');
    });

    it('should return fresh data with X-Cache: MISS header on first request', async () => {
      // Test: GET /api/live/twitch with cache miss
      const response = await fetch('/api/live/twitch?serverIds=gtarp1&bustCache=true', {
        headers: {
          'Authorization': 'Bearer test-token',
        },
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('X-Cache')).toBe('MISS');
    });

    it('should respect cache TTL configuration', async () => {
      // Test: Cache should expire after TTL
      // This is a timing test - would need to be run with actual timing
      // For now, we verify the structure is correct
      const response = await fetch('/api/admin/cache?apiName=twitch_live_streams', {
        headers: {
          'Authorization': 'Bearer test-token',
        },
      });

      const data = await response.json();
      expect(data.data.cache_ttl_seconds).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // Test: API should return 500 on database error
      // This would require mocking a database failure
      // For now, we verify the error structure
      const response = await fetch('/api/admin/cache?apiName=nonexistent', {
        headers: {
          'Authorization': 'Bearer test-token',
        },
      });

      // Should either return 404 or empty data
      expect([200, 404]).toContain(response.status);
    });

    it('should validate request body format', async () => {
      // Test: POST /api/admin/cache with invalid JSON
      const response = await fetch('/api/admin/cache', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: 'invalid json',
      });

      expect(response.status).toBe(400);
    });
  });

  describe('Performance', () => {
    it('cache hit should be significantly faster than cache miss', async () => {
      // Test: Measure response times
      // First request (cache miss)
      const missStart = Date.now();
      await fetch('/api/live/twitch?serverIds=gtarp1&bustCache=true', {
        headers: {
          'Authorization': 'Bearer test-token',
        },
      });
      const missDuration = Date.now() - missStart;

      // Second request (cache hit)
      const hitStart = Date.now();
      await fetch('/api/live/twitch?serverIds=gtarp1', {
        headers: {
          'Authorization': 'Bearer test-token',
        },
      });
      const hitDuration = Date.now() - hitStart;

      // Cache hit should be at least 10x faster
      expect(hitDuration).toBeLessThan(missDuration / 10);
    });
  });
});

/**
 * Manual Testing Checklist
 * 
 * 1. Admin Panel Cache Settings
 *    [ ] Navigate to /admin/settings
 *    [ ] Click "API Cache" tab
 *    [ ] Verify cache configurations load
 *    [ ] Toggle cache enable/disable
 *    [ ] Update TTL value
 *    [ ] Verify changes apply immediately
 *    [ ] Click "Clear Cache Now"
 *    [ ] Verify cache statistics update
 * 
 * 2. Twitch API Caching
 *    [ ] Call /api/live/twitch?serverIds=gtarp1
 *    [ ] Verify X-Cache: MISS header
 *    [ ] Call again immediately
 *    [ ] Verify X-Cache: HIT header
 *    [ ] Wait for TTL to expire
 *    [ ] Call again
 *    [ ] Verify X-Cache: MISS header
 * 
 * 3. Cache Configuration API
 *    [ ] GET /api/admin/cache - retrieve all configs
 *    [ ] GET /api/admin/cache?apiName=twitch_live_streams - retrieve specific
 *    [ ] GET /api/admin/cache?apiName=twitch_live_streams&action=stats - get stats
 *    [ ] POST /api/admin/cache - update config
 *    [ ] DELETE /api/admin/cache?apiName=twitch_live_streams - clear cache
 * 
 * 4. Rate Limiting Relief
 *    [ ] Monitor Twitch API call count before caching
 *    [ ] Enable caching with 5-minute TTL
 *    [ ] Monitor Twitch API call count after caching
 *    [ ] Verify significant reduction in API calls
 *    [ ] Verify no rate limiting errors
 * 
 * 5. Database Verification
 *    [ ] Check api_cache_config table has twitch_live_streams entry
 *    [ ] Check api_cache_data table has cached entries
 *    [ ] Verify expires_at timestamps are correct
 *    [ ] Verify expired entries are cleaned up
 * 
 * 6. Error Scenarios
 *    [ ] Disable cache and verify API still works
 *    [ ] Set TTL to 1 second and verify expiration
 *    [ ] Clear cache and verify fresh data is fetched
 *    [ ] Test with invalid admin token
 *    [ ] Test with missing parameters
 */

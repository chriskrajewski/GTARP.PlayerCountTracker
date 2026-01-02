# API Cache Management System

## Overview

The API Cache Management System is a database-backed caching solution designed to reduce rate limiting issues with external APIs (like Twitch) and improve overall system performance. It allows administrators to configure cache settings on-the-fly without requiring server restarts.

## Features

- **Database-Backed Persistence**: Cache data is stored in PostgreSQL, surviving server restarts
- **Configurable TTL**: Set custom Time-To-Live values for each API endpoint
- **Real-Time Configuration**: Update cache settings instantly without restarting
- **Automatic Expiration**: Expired cache entries are automatically cleaned up
- **Cache Statistics**: Monitor cache performance with real-time statistics
- **Admin Dashboard**: User-friendly interface in the admin settings panel

## Architecture

### Database Schema

#### `api_cache_config` Table
Stores configuration for each cached API endpoint:

```sql
- id: BIGSERIAL PRIMARY KEY
- api_name: TEXT UNIQUE (e.g., 'twitch_live_streams')
- cache_enabled: BOOLEAN (default: true)
- cache_ttl_seconds: INTEGER (default: 300)
- last_cache_clear: TIMESTAMP WITH TIME ZONE
- created_at: TIMESTAMP WITH TIME ZONE
- updated_at: TIMESTAMP WITH TIME ZONE
- updated_by: TEXT
- description: TEXT
```

#### `api_cache_data` Table
Stores actual cached data:

```sql
- id: BIGSERIAL PRIMARY KEY
- api_name: TEXT (foreign key to api_cache_config)
- cache_key: TEXT (unique identifier for cached data)
- cache_value: JSONB (the cached data)
- expires_at: TIMESTAMP WITH TIME ZONE
- created_at: TIMESTAMP WITH TIME ZONE
```

### Core Components

#### 1. **APICache Class** (`lib/api-cache.ts`)

Singleton class providing cache operations:

```typescript
// Get cached value
const value = await cache.get<T>('twitch_live_streams', cacheKey);

// Set cached value
await cache.set('twitch_live_streams', cacheKey, data);

// Clear all cache for an API
await cache.clear('twitch_live_streams');

// Clear expired entries
const cleared = await cache.clearExpired('twitch_live_streams');

// Update configuration
await cache.updateConfig('twitch_live_streams', {
  cache_ttl_seconds: 600,
  cache_enabled: true
});

// Get statistics
const stats = await cache.getStats('twitch_live_streams');

// Get all configurations
const configs = await cache.getAllConfigs();
```

#### 2. **Admin API Endpoint** (`app/api/admin/cache/route.ts`)

RESTful API for managing cache configurations:

**GET** - Retrieve cache configurations
```bash
# Get all configurations
curl http://localhost:3000/api/admin/cache \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Get specific API configuration
curl http://localhost:3000/api/admin/cache?apiName=twitch_live_streams \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Get cache statistics
curl http://localhost:3000/api/admin/cache?apiName=twitch_live_streams&action=stats \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**POST** - Update cache configuration
```bash
curl -X POST http://localhost:3000/api/admin/cache \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "apiName": "twitch_live_streams",
    "cache_enabled": true,
    "cache_ttl_seconds": 600,
    "description": "Twitch live streams API cache"
  }'
```

**DELETE** - Clear cache
```bash
curl -X DELETE http://localhost:3000/api/admin/cache?apiName=twitch_live_streams \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

#### 3. **Admin UI Component** (`components/admin/cache-settings-card.tsx`)

React component for the admin dashboard providing:
- Enable/disable caching per API
- Adjust TTL on-the-fly
- View cache statistics (total entries, expired entries)
- Clear cache manually
- Last cache clear timestamp

#### 4. **Twitch API Integration** (`app/api/live/twitch/route.ts`)

The Twitch API endpoint now uses the cache system:

```typescript
// Check cache first
const cache = getAPICache();
const cacheKey = `twitch_streams_${serverIds.join(',')}`;

if (!bustCache) {
  const cachedData = await cache.get('twitch_live_streams', cacheKey);
  if (cachedData) {
    return NextResponse.json(cachedData, {
      headers: { 'X-Cache': 'HIT' }
    });
  }
}

// Fetch from Twitch API...
const responseData = { servers, timestamp };

// Cache the response
await cache.set('twitch_live_streams', cacheKey, responseData);

return NextResponse.json(responseData, {
  headers: { 'X-Cache': 'MISS' }
});
```

## Usage

### For Administrators

1. **Navigate to Admin Settings**
   - Go to `/admin/settings`
   - Click the "API Cache" tab

2. **Configure Cache Settings**
   - Toggle "Enable Caching" to enable/disable
   - Adjust "Cache TTL (seconds)" to set how long data is cached
   - Changes apply immediately without server restart

3. **Monitor Cache Performance**
   - View "Cached Entries" count
   - Check "Expired" entries
   - See "Last cleared" timestamp

4. **Clear Cache**
   - Click "Clear Cache Now" button to manually clear all cached data for an API
   - Useful when you need fresh data immediately

### For Developers

#### Adding Cache to a New API

```typescript
import { getAPICache } from '@/lib/api-cache';

export async function GET(request: NextRequest) {
  const cache = getAPICache();
  const cacheKey = 'unique_identifier_for_this_request';
  
  // Check cache
  const cached = await cache.get('your_api_name', cacheKey);
  if (cached) {
    return NextResponse.json(cached, {
      headers: { 'X-Cache': 'HIT' }
    });
  }
  
  // Fetch data
  const data = await fetchFromExternalAPI();
  
  // Cache it
  await cache.set('your_api_name', cacheKey, data);
  
  return NextResponse.json(data, {
    headers: { 'X-Cache': 'MISS' }
  });
}
```

#### Configuring a New API

```typescript
// In database migration or initialization
INSERT INTO api_cache_config (api_name, cache_enabled, cache_ttl_seconds, description)
VALUES ('your_api_name', true, 300, 'Description of your API')
ON CONFLICT (api_name) DO NOTHING;
```

## Configuration

### Default Configuration

The system comes pre-configured with:

```
API Name: twitch_live_streams
Cache Enabled: true
Cache TTL: 300 seconds (5 minutes)
Description: Twitch live streams API cache
```

### Adjusting TTL

The TTL (Time-To-Live) determines how long cached data is valid:

- **Short TTL (30-60s)**: Fresh data, more API calls
- **Medium TTL (300-600s)**: Balanced approach (default)
- **Long TTL (1800-3600s)**: Fewer API calls, potentially stale data

**Recommendation for Twitch API**: 300-600 seconds (5-10 minutes)

## Performance Impact

### Before Caching
- Every request hits the Twitch API
- Rate limiting issues after ~60 requests/minute
- Higher latency (API response time)

### After Caching
- First request hits Twitch API, subsequent requests served from cache
- Dramatically reduced API calls (up to 90% reduction)
- Lower latency (database queries are faster)
- Configurable freshness vs. performance trade-off

## Monitoring

### Cache Statistics

Access cache statistics via the admin dashboard or API:

```bash
curl http://localhost:3000/api/admin/cache?apiName=twitch_live_streams&action=stats \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .
```

Response:
```json
{
  "success": true,
  "data": {
    "api_name": "twitch_live_streams",
    "cache_enabled": true,
    "cache_ttl_seconds": 300,
    "total_entries": 42,
    "expired_entries": 5,
    "last_cache_clear": "2024-01-02T15:30:00Z"
  }
}
```

### Cache Headers

API responses include cache status headers:

```
X-Cache: HIT    # Data served from cache
X-Cache: MISS   # Data fetched from external API
```

## Troubleshooting

### Cache Not Working

1. **Check if cache is enabled**
   ```bash
   curl http://localhost:3000/api/admin/cache?apiName=twitch_live_streams \
     -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.data.cache_enabled'
   ```

2. **Verify database connection**
   - Check Supabase connection in logs
   - Ensure `SUPABASE_SERVICE_ROLE_KEY` is set

3. **Clear cache and retry**
   ```bash
   curl -X DELETE http://localhost:3000/api/admin/cache?apiName=twitch_live_streams \
     -H "Authorization: Bearer $ADMIN_TOKEN"
   ```

### High Expired Entries Count

- Indicates cache TTL is too short
- Increase TTL in admin panel
- Or manually clear expired entries (automatic cleanup runs periodically)

### Cache Not Clearing

- Verify admin authentication token
- Check database permissions
- Review server logs for errors

## Security

- **Authentication Required**: All cache management endpoints require admin authentication
- **Row Level Security**: Database policies restrict access to authorized users
- **Sensitive Data**: Cache values are stored as JSONB, no sensitive data should be cached
- **Audit Trail**: `updated_by` field tracks who made configuration changes

## Future Enhancements

- [ ] Redis support for distributed caching
- [ ] Cache warming strategies
- [ ] Advanced statistics and analytics
- [ ] Cache invalidation webhooks
- [ ] Per-user cache configurations
- [ ] Cache compression for large datasets
- [ ] Distributed cache synchronization

## API Reference

### GET /api/admin/cache

Get all cache configurations or specific API configuration.

**Query Parameters:**
- `apiName` (optional): Specific API name to retrieve
- `action` (optional): `stats` to get cache statistics

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "api_name": "twitch_live_streams",
      "cache_enabled": true,
      "cache_ttl_seconds": 300,
      "last_cache_clear": "2024-01-02T15:30:00Z",
      "description": "Twitch live streams API cache"
    }
  ],
  "timestamp": "2024-01-02T16:00:00Z"
}
```

### POST /api/admin/cache

Update cache configuration for an API.

**Request Body:**
```json
{
  "apiName": "twitch_live_streams",
  "cache_enabled": true,
  "cache_ttl_seconds": 600,
  "description": "Updated description"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "api_name": "twitch_live_streams",
    "cache_enabled": true,
    "cache_ttl_seconds": 600,
    "updated_at": "2024-01-02T16:00:00Z"
  },
  "message": "Cache configuration updated successfully",
  "timestamp": "2024-01-02T16:00:00Z"
}
```

### DELETE /api/admin/cache

Clear all cache entries for an API.

**Query Parameters:**
- `apiName` (required): API name to clear cache for

**Response:**
```json
{
  "success": true,
  "message": "Cache cleared for twitch_live_streams",
  "timestamp": "2024-01-02T16:00:00Z"
}
```

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review server logs
3. Contact the development team

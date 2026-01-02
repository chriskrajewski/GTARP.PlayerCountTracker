# API Cache Management System - Technical Architecture

## System Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CLIENT REQUEST (Twitch API)                         │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │
                                     ▼
                    ┌────────────────────────────────┐
                    │  /api/live/twitch?serverIds=X  │
                    └────────────────┬────────────────┘
                                     │
                                     ▼
                    ┌────────────────────────────────┐
                    │   Check Cache Enabled?         │
                    │   (bustCache param check)      │
                    └────────────────┬────────────────┘
                                     │
                    ┌────────────────┴────────────────┐
                    │                                 │
                    ▼                                 ▼
            ┌──────────────────┐          ┌──────────────────┐
            │  Cache Enabled   │          │ Cache Disabled   │
            │  & Not Busted    │          │ or Bust Requested│
            └────────┬─────────┘          └────────┬─────────┘
                     │                             │
                     ▼                             │
        ┌────────────────────────────┐            │
        │ Query api_cache_data table │            │
        │ WHERE:                     │            │
        │  - api_name = 'twitch...'  │            │
        │  - cache_key = serverIds   │            │
        │  - expires_at > NOW()      │            │
        └────────────┬───────────────┘            │
                     │                             │
        ┌────────────┴────────────┐               │
        │                         │               │
        ▼                         ▼               │
    ┌────────┐            ┌──────────────┐       │
    │ CACHE  │            │ CACHE MISS   │       │
    │  HIT   │            │ or EXPIRED   │       │
    └────┬───┘            └──────┬───────┘       │
         │                       │               │
         │                       └───────┬───────┘
         │                               │
         │                               ▼
         │                  ┌────────────────────────────┐
         │                  │ Fetch from Twitch API      │
         │                  │ 1. Get OAuth Token         │
         │                  │ 2. Get Game IDs            │
         │                  │ 3. Fetch Live Streams      │
         │                  │ 4. Filter by Config        │
         │                  │ 5. Build Response          │
         │                  └────────────┬───────────────┘
         │                               │
         │                               ▼
         │                  ┌────────────────────────────┐
         │                  │ Cache Response Data        │
         │                  │ INSERT/UPSERT into        │
         │                  │ api_cache_data:           │
         │                  │  - api_name               │
         │                  │  - cache_key              │
         │                  │  - cache_value (JSONB)    │
         │                  │  - expires_at (NOW + TTL) │
         │                  └────────────┬───────────────┘
         │                               │
         └───────────────┬───────────────┘
                         │
                         ▼
            ┌────────────────────────────┐
            │ Return Response to Client  │
            │ Headers:                   │
            │  - X-Cache: HIT/MISS       │
            │  - Cache-Control: ...      │
            └────────────────────────────┘
```

## Admin Configuration Flow

```
┌──────────────────────────────────────────────────────────────┐
│              Admin Panel (/admin/settings)                   │
│                   API Cache Tab                              │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
        ┌────────────────────────────────┐
        │ Load Cache Configurations      │
        │ GET /api/admin/cache           │
        └────────────────┬───────────────┘
                         │
                         ▼
        ┌────────────────────────────────┐
        │ Query api_cache_config table   │
        │ SELECT * FROM api_cache_config │
        └────────────────┬───────────────┘
                         │
                         ▼
        ┌────────────────────────────────┐
        │ Display Configuration Cards    │
        │ For Each API:                  │
        │  - Enable/Disable Toggle       │
        │  - TTL Input Field             │
        │  - Statistics Display          │
        │  - Clear Cache Button          │
        └────────────────┬───────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
    ┌────────┐      ┌────────┐      ┌──────────┐
    │ Toggle │      │ Update │      │  Clear   │
    │ Cache  │      │  TTL   │      │  Cache   │
    └────┬───┘      └────┬───┘      └────┬─────┘
         │               │               │
         ▼               ▼               ▼
    ┌────────────────────────────────────────────┐
    │ POST /api/admin/cache                      │
    │ {                                          │
    │   apiName: "twitch_live_streams",          │
    │   cache_enabled: true/false,               │
    │   cache_ttl_seconds: 300                   │
    │ }                                          │
    └────────────┬─────────────────────────────┘
                 │
                 ▼
    ┌────────────────────────────────────────────┐
    │ UPDATE api_cache_config                    │
    │ WHERE api_name = 'twitch_live_streams'     │
    │ SET cache_enabled = ?,                     │
    │     cache_ttl_seconds = ?,                 │
    │     updated_at = NOW(),                    │
    │     updated_by = admin_user                │
    └────────────┬─────────────────────────────┘
                 │
                 ▼
    ┌────────────────────────────────────────────┐
    │ Invalidate In-Memory Config Cache          │
    │ (TTL: 1 minute)                            │
    └────────────┬─────────────────────────────┘
                 │
                 ▼
    ┌────────────────────────────────────────────┐
    │ Return Updated Config to Admin             │
    │ Display Success Toast Notification         │
    │ Changes Apply Immediately!                 │
    └────────────────────────────────────────────┘
```

## Cache Statistics Flow

```
┌──────────────────────────────────────────────────────────────┐
│         Admin Panel - Cache Statistics Display               │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
        ┌────────────────────────────────┐
        │ GET /api/admin/cache           │
        │ ?apiName=twitch_live_streams   │
        │ &action=stats                  │
        └────────────────┬───────────────┘
                         │
                         ▼
        ┌────────────────────────────────────────┐
        │ Query api_cache_config                 │
        │ Get cache configuration                │
        └────────────────┬──────────────────────┘
                         │
        ┌────────────────┴──────────────────┐
        │                                   │
        ▼                                   ▼
    ┌──────────────────┐          ┌──────────────────┐
    │ Count Total      │          │ Count Expired    │
    │ Cache Entries    │          │ Cache Entries    │
    │                  │          │                  │
    │ SELECT COUNT(*)  │          │ SELECT COUNT(*)  │
    │ FROM             │          │ FROM             │
    │ api_cache_data   │          │ api_cache_data   │
    │ WHERE:           │          │ WHERE:           │
    │ api_name = 'X'   │          │ api_name = 'X'   │
    │                  │          │ AND expires_at   │
    │                  │          │ < NOW()          │
    └────────┬─────────┘          └────────┬─────────┘
             │                             │
             └──────────────┬──────────────┘
                            │
                            ▼
        ┌────────────────────────────────────────┐
        │ Return Statistics Object               │
        │ {                                      │
        │   api_name: "twitch_live_streams",     │
        │   cache_enabled: true,                 │
        │   cache_ttl_seconds: 300,              │
        │   total_entries: 42,                   │
        │   expired_entries: 5,                  │
        │   last_cache_clear: "2024-01-02T..."   │
        │ }                                      │
        └────────────┬──────────────────────────┘
                     │
                     ▼
        ┌────────────────────────────────────────┐
        │ Display in Admin UI                    │
        │ - Cached Entries: 42                   │
        │ - Expired: 5                           │
        │ - TTL: 300 seconds (5 minutes)         │
        │ - Last Cleared: [timestamp]            │
        └────────────────────────────────────────┘
```

## Data Flow - Twitch API with Cache

```
REQUEST TIMELINE:

Time 0s:
  Client → GET /api/live/twitch?serverIds=gtarp1,gtarp2
  ├─ Check cache: MISS (first request)
  ├─ Fetch from Twitch API (takes ~2-3 seconds)
  ├─ Cache response (TTL: 300s)
  └─ Return to client (X-Cache: MISS)

Time 5s:
  Client → GET /api/live/twitch?serverIds=gtarp1,gtarp2
  ├─ Check cache: HIT (expires at 300s)
  ├─ Return cached data immediately (~50ms)
  └─ Return to client (X-Cache: HIT)

Time 150s:
  Client → GET /api/live/twitch?serverIds=gtarp1,gtarp2
  ├─ Check cache: HIT (expires at 300s)
  ├─ Return cached data immediately (~50ms)
  └─ Return to client (X-Cache: HIT)

Time 305s:
  Client → GET /api/live/twitch?serverIds=gtarp1,gtarp2
  ├─ Check cache: MISS (expired at 300s)
  ├─ Fetch from Twitch API (takes ~2-3 seconds)
  ├─ Cache response (TTL: 300s, expires at 605s)
  └─ Return to client (X-Cache: MISS)

RESULT:
  - 4 requests total
  - 2 Twitch API calls (50% reduction)
  - 2 cache hits (served in ~50ms each)
  - Total time saved: ~4-6 seconds
```

## Database Schema Relationships

```
┌─────────────────────────────────────────────────────────────┐
│                   api_cache_config                          │
├─────────────────────────────────────────────────────────────┤
│ id (PK)                                                     │
│ api_name (UNIQUE) ◄──────────────────────────────────────┐  │
│ cache_enabled                                            │  │
│ cache_ttl_seconds                                        │  │
│ last_cache_clear                                         │  │
│ created_at                                               │  │
│ updated_at                                               │  │
│ updated_by                                               │  │
│ description                                              │  │
└─────────────────────────────────────────────────────────────┘
                                                            │
                                                            │
                                                            │
┌─────────────────────────────────────────────────────────────┐
│                   api_cache_data                            │
├─────────────────────────────────────────────────────────────┤
│ id (PK)                                                     │
│ api_name (FK) ──────────────────────────────────────────────┤
│ cache_key                                                   │
│ cache_value (JSONB)                                         │
│ expires_at (indexed for cleanup)                            │
│ created_at                                                  │
│                                                             │
│ UNIQUE(api_name, cache_key)                                │
└─────────────────────────────────────────────────────────────┘
```

## Component Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  Admin Settings Page                        │
│              (/admin/settings/page.tsx)                     │
└────────────────────────┬────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
    ┌────────┐      ┌────────┐      ┌──────────────┐
    │Visitor │      │  Data  │      │ CacheSettings│
    │Tracking│      │Management│    │    Card      │
    │  Tab   │      │  Tab   │      │   (NEW)      │
    └────────┘      └────────┘      └──────┬───────┘
                                           │
                                           ▼
                            ┌──────────────────────────┐
                            │ CacheSettingsCard        │
                            │ Component                │
                            │                          │
                            │ - Fetch configs          │
                            │ - Display cards          │
                            │ - Handle toggle          │
                            │ - Handle TTL update      │
                            │ - Handle clear cache     │
                            │ - Show statistics        │
                            └──────────────────────────┘
                                           │
                                           ▼
                            ┌──────────────────────────┐
                            │ API Calls                │
                            │                          │
                            │ GET /api/admin/cache     │
                            │ POST /api/admin/cache    │
                            │ DELETE /api/admin/cache  │
                            └──────────────────────────┘
```

## Error Handling Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    API Request                              │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
        ┌────────────────────────────────┐
        │ Try to Get Cache               │
        └────────────────┬───────────────┘
                         │
        ┌────────────────┴────────────────┐
        │                                 │
        ▼                                 ▼
    ┌────────┐                    ┌──────────────┐
    │ Success│                    │ Error        │
    │ (HIT)  │                    │ (DB Error)   │
    └────┬───┘                    └──────┬───────┘
         │                               │
         │                               ▼
         │                    ┌──────────────────────┐
         │                    │ Log Error            │
         │                    │ Return null          │
         │                    │ Continue to fetch    │
         │                    │ from external API    │
         │                    └──────────┬───────────┘
         │                               │
         └───────────────┬───────────────┘
                         │
                         ▼
        ┌────────────────────────────────┐
        │ Fetch from External API        │
        └────────────────┬───────────────┘
                         │
        ┌────────────────┴────────────────┐
        │                                 │
        ▼                                 ▼
    ┌────────┐                    ┌──────────────┐
    │ Success│                    │ Error        │
    │        │                    │              │
    └────┬───┘                    └──────┬───────┘
         │                               │
         ▼                               ▼
    ┌────────┐                    ┌──────────────┐
    │ Try to │                    │ Return Error │
    │ Cache  │                    │ Response     │
    │ Result │                    │ (500)        │
    └────┬───┘                    └──────────────┘
         │
    ┌────┴────┐
    │          │
    ▼          ▼
┌────────┐ ┌────────┐
│Success │ │ Error  │
│ (log)  │ │ (log)  │
└────┬───┘ └────┬───┘
     │          │
     └────┬─────┘
          │
          ▼
    ┌──────────────┐
    │ Return Data  │
    │ to Client    │
    └──────────────┘
```

## Performance Characteristics

```
SCENARIO 1: Cache Hit
├─ Database Query: ~5-10ms
├─ JSON Serialization: ~1-2ms
├─ Network Latency: ~20-50ms
└─ Total: ~30-60ms

SCENARIO 2: Cache Miss (Fetch from Twitch)
├─ Get OAuth Token: ~500-800ms
├─ Get Game IDs: ~300-500ms
├─ Fetch Streams (5 pages): ~1000-1500ms
├─ Filter & Process: ~100-200ms
├─ Cache Write: ~10-20ms
├─ JSON Serialization: ~5-10ms
├─ Network Latency: ~20-50ms
└─ Total: ~2000-3100ms

IMPROVEMENT:
├─ Cache Hit vs Miss: 50-100x faster
├─ API Call Reduction: 80-90% (with 5min TTL)
├─ Rate Limit Relief: Significant
└─ User Experience: Much better responsiveness
```

## Monitoring & Observability

```
METRICS TO TRACK:
├─ Cache Hit Rate (%)
│  └─ Calculated: (HIT / (HIT + MISS)) * 100
├─ Cache Size (entries)
│  └─ Query: SELECT COUNT(*) FROM api_cache_data
├─ Expired Entries (%)
│  └─ Query: SELECT COUNT(*) WHERE expires_at < NOW()
├─ API Call Reduction (%)
│  └─ Calculated: (Cached Calls / Total Calls) * 100
├─ Average Response Time (ms)
│  └─ Measured: Response time with X-Cache header
└─ Database Size (bytes)
   └─ Query: SELECT pg_total_relation_size('api_cache_data')

LOGGING:
├─ Cache HIT: [LiveTwitch] Returning cached data for servers: X, Y, Z
├─ Cache MISS: [LiveTwitch] Fetched X streams from Y games
├─ Cache SET: [APICache] Cached response for twitch_live_streams
├─ Cache ERROR: [APICache] Error retrieving cache: [error details]
└─ Config UPDATE: [APICache] Config updated for twitch_live_streams by admin_user
```

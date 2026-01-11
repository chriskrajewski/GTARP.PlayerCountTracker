---
name: Memory Optimization Plan
overview: Comprehensive memory optimization plan to reduce memory consumption from 90% to sustainable levels on t4g.small instances by implementing query limits, bounded caches, pagination, response streaming, and efficient data processing.
todos:
  - id: reduce-query-limits
    content: ""
    status: pending
  - id: add-fivem-cache-limits
    content: Add LRU cache with size limit (100 entries) and periodic cleanup to liveCache in app/api/live/fivem/route.ts
    status: pending
  - id: add-streams-cache-limits
    content: Add size limits to gameStreamsMemoryCache (50 entries) and inflightGameFetches (20 concurrent) in app/api/streams/[serverId]/route.ts
    status: pending
  - id: add-api-cache-limits
    content: Add LRU eviction with max 50 entries to configCache in lib/api-cache.ts
    status: pending
  - id: improve-geo-cache
    content: Improve geoCache cleanup frequency and reduce MAX_CACHE_SIZE from 10k to 5k in lib/geolocation.ts
    status: pending
  - id: optimize-sampling
    content: "Optimize time-based sampling: Reduce samplePeriods for 90d+ ranges, reduce per-period limit to 100. CRITICAL: Always preserve peak values, first/last points, and minimum 100 points per server for accurate averages."
    status: pending
  - id: database-aggregation
    content: Create getPlayerCountsAggregated() for 'all' time range using SQL GROUP BY monthly aggregation. Reduces 100k+ records to ~500-1000 monthly averages while preserving trends and statistics.
    status: pending
  - id: add-response-limits
    content: "Add maxResponseSize limits (10k records) and pagination support to API routes. CRITICAL: Ensure pagination doesn't split time ranges, include data completeness metadata, preserve all data needed for stats calculations."
    status: pending
  - id: data-quality-tests
    content: "Add validation tests: peak accuracy, average accuracy (within 2%), chart quality, current stats accuracy, time range boundaries. Run before deploying each optimization phase."
    status: pending
  - id: memory-monitoring
    content: Add memory usage logging to health check endpoint and admin dashboard
    status: pending
---

# Memory Optimization Plan

## Data Quality Guarantee

**This plan prioritizes data accuracy and user experience.** All optimizations include safeguards to ensure:

- ✅ **Peak values are always preserved** - Peak player counts remain accurate
- ✅ **Current stats are always accurate** - Latest data point always included
- ✅ **Averages remain accurate** - Minimum 100 data points per server for statistical accuracy
- ✅ **Charts render smoothly** - Sufficient data points for all time ranges
- ✅ **Time range boundaries are correct** - First and last points always included
- ✅ **"All" time range uses smart aggregation** - Monthly averages preserve long-term trends (99% memory reduction, 100% trend accuracy)

**No user-facing data quality will be compromised.** The optimizations focus on:

1. Using database-level aggregation for very large ranges (instead of fetching raw data)
2. Progressive limits based on time range (more data for short ranges, less for long ranges)
3. Smart sampling that preserves statistical accuracy
4. Cache management (doesn't affect data quality, only performance)

## Current Memory Issues Identified

### Critical Issues (High Memory Impact)

1. **Large Database Query Limits**

- `lib/data.ts`: `getPlayerCounts()` fetches up to 100,000 records for "all" time range
- `lib/data.ts`: `getServerCapacities()` fetches up to 100,000 records for "all" time range  
- `lib/data.ts`: `getStreamCounts()` fetches up to 50,000 records
- All data loaded into memory arrays before processing

2. **Unbounded In-Memory Caches**

- `app/api/live/fivem/route.ts`: `liveCache` Map - no size limit, no cleanup
- `app/api/streams/[serverId]/route.ts`: `gameStreamsMemoryCache` Map - no size limit
- `app/api/streams/[serverId]/route.ts`: `inflightGameFetches` Map - no size limit
- `lib/api-cache.ts`: `configCache` Map - no size limit
- `lib/geolocation.ts`: `geoCache` - cleanup only at 90% capacity

3. **Large Array Processing**

- Multiple functions create `allData` arrays that can grow to 100k+ items
- `timestampGroups` objects can accumulate large amounts of data
- Multiple `.reverse()`, `.sort()` operations on large arrays in memory

4. **No Response Streaming**

- All JSON responses built entirely in memory before sending
- Large responses (100k+ records) consume significant memory during serialization

### Moderate Issues

5. **Inefficient Data Processing**

- `getPlayerCountsWithTimeBasedSampling()` creates multiple intermediate arrays
- Data duplication during processing (original + sampled data)

6. **No Query Result Limits**

- Many queries don't enforce maximum result sizes
- Time-based sampling can still accumulate large datasets

## Optimization Strategy

### Phase 1: Database Query Optimization (Data Quality Preserved)

**File: `lib/data.ts`**

1. **Smart Query Limits with Data Quality Safeguards**

**For `getPlayerCounts()`:**

- **Short ranges (1h-24h)**: Keep current limits (50k) - users need detailed minute-by-minute data
- **Medium ranges (7d-30d)**: Reduce to 20,000 records - enough for accurate hourly/daily aggregation
- **Long ranges (90d-180d)**: Reduce to 15,000 records - sufficient for weekly aggregation
- **Very long (365d)**: Reduce to 10,000 records - monthly aggregation needs fewer points
- **"all" time range**: Use database-level monthly aggregation instead of raw data (fetch ~500-1000 monthly averages)

**For `getServerCapacities()`:**

- Apply same progressive limits as `getPlayerCounts()`
- Capacity changes are infrequent, so fewer data points needed
- Ensure latest capacity is always included for accurate current capacity calculations

**For `getStreamCounts()`:**

- Reduce to 10,000 for all ranges (stream data is less dense than player counts)
- Ensure latest data point is always included for current stream count

**Data Quality Guarantees:**

- Always include the most recent data point (for current stats)
- Always include peak values (for accurate peak calculations)
- Ensure minimum data points for accurate averages (at least 100 points per server)
- For "all" time range, use monthly aggregation to preserve long-term trends

2. **Database-Level Aggregation for "all" Time Range**

- Create a new function `getPlayerCountsAggregated()` for "all" time range
- Use SQL GROUP BY to aggregate by month at database level
- Fetch monthly averages, peaks, and sample points (reduces 100k+ records to ~500-1000)
- Preserves data quality: monthly trends, peak detection, average calculations
- Reduces memory by 99% while maintaining statistical accuracy

3. **Optimize Time-Based Sampling (Maintain Accuracy)**

- Keep current `samplePeriods` for 7d-30d (maintains chart quality)
- For 90d-180d: Reduce `samplePeriods` from 30-40 to 25-30 (still sufficient for weekly aggregation)
- For 365d: Reduce to 20 periods (monthly aggregation needs fewer samples)
- Reduce per-period `limit` from 200 to 100 (still captures peaks and averages accurately)
- **Critical**: Always include first and last data point in each period (preserves range boundaries)
- **Critical**: Include peak values from each period (preserves maximum accuracy)

4. **Progressive Data Fetching**

- For ranges >30d, fetch data in time-ordered chunks
- Process and aggregate incrementally instead of loading all into memory
- Maintain running statistics (peak, average) during processing
- Release processed chunks from memory immediately

### Phase 2: Cache Management

**File: `app/api/live/fivem/route.ts`**

1. **Add Size Limits to `liveCache`**

- Implement LRU eviction with max size of 100 entries
- Add periodic cleanup every 5 minutes
- Remove stale entries older than `STALE_FALLBACK_MS`

**File: `app/api/streams/[serverId]/route.ts`**

2. **Add Size Limits to `gameStreamsMemoryCache`**

- Implement LRU eviction with max size of 50 game entries
- Add TTL-based cleanup
- Limit cache entry size (max 500 streams per game)

3. **Add Size Limits to `inflightGameFetches`**

- Max 20 concurrent fetches
- Auto-cleanup completed promises after 30 seconds

**File: `lib/api-cache.ts`**

4. **Add Size Limits to `configCache`**

- Max 50 config entries
- Implement LRU eviction
- Reduce `CONFIG_CACHE_TTL` from 60s to 30s

**File: `lib/geolocation.ts`**

5. **Improve `geoCache` Cleanup**

- Run cleanup more frequently (every 100 requests or 5 minutes)
- Reduce `MAX_CACHE_SIZE` from 10,000 to 5,000
- Implement LRU eviction instead of timestamp-based only

### Phase 3: Response Streaming

**Files: Multiple API routes**

1. **Implement Streaming for Large Responses**

- Use Next.js streaming responses for queries returning >1,000 records
- Stream JSON arrays incrementally
- Add `maxResponseSize` limits (10,000 records per response)

2. **Optimize JSON Serialization**

- Use `JSON.stringify()` with streaming for large objects
- Consider compression for large responses
- Add response size monitoring

### Phase 4: Data Processing Optimization

**File: `lib/data.ts`**

1. **Reduce Intermediate Arrays**

- Process data incrementally instead of accumulating
- Use generators/iterators for large datasets
- Eliminate unnecessary `.reverse()` operations (use database ordering)

2. **Optimize Sampling Logic (Preserve Statistical Accuracy)**

- Sample during fetch instead of post-processing
- Use database-level aggregation when possible (especially for "all" time range)
- Reduce memory footprint of `timestampGroups` by processing incrementally
- **Ensure peak values are preserved** during sampling (critical for accurate peak stats)
- **Ensure first/last points are preserved** (critical for accurate current stats and range boundaries)
- Maintain minimum sample size of 100 points per server for accurate averages

### Phase 5: Memory Monitoring & Limits

1. **Add Memory Monitoring**

- Log memory usage in health check endpoint
- Add memory usage metrics to admin dashboard
- Alert when memory exceeds 80% threshold

2. **Add Response Size Limits (With Data Quality Checks)**

- Enforce max response size of 10MB
- Return paginated responses for large queries
- Add `maxRecords` query parameter with default limits
- **Critical**: When paginating, ensure each page includes complete time ranges (don't split mid-day)
- **Critical**: Always include metadata about data completeness (e.g., "showing 10k of 50k records")
- **Critical**: For stats calculations, ensure all required data is available (don't calculate peak from partial data)

3. **Optimize Next.js Configuration**

- Review `next.config.mjs` for memory-related settings
- Consider enabling experimental features for better memory management
- Review Node.js memory limits in production

## Implementation Priority

### High Priority (Immediate Impact)

1. Reduce database query limits (Phase 1.1)
2. Add cache size limits (Phase 2.1-2.4)
3. Improve geoCache cleanup (Phase 2.5)

### Medium Priority (Significant Impact)

4. Implement pagination (Phase 1.2)
5. Optimize time-based sampling (Phase 1.3, Phase 4.2)
6. Add response size limits (Phase 5.2)

### Low Priority (Long-term)

7. Implement response streaming (Phase 3)
8. Reduce intermediate arrays (Phase 4.1)
9. Add memory monitoring (Phase 5.1)

## Expected Results

- **Memory Reduction**: 40-60% reduction in peak memory usage
- **Query Performance**: Faster response times for large queries
- **Cache Efficiency**: Better cache hit rates with bounded caches
- **Scalability**: Ability to handle more concurrent requests

## Data Quality Safeguards

### Critical Requirements (Must Not Break)

1. **Peak Calculations**: Must always include peak values in sampled data
2. **Current Stats**: Must always include the most recent data point
3. **Average Calculations**: Must have sufficient data points (minimum 100 per server)
4. **Chart Rendering**: Must have enough points for smooth chart display (varies by time range)
5. **Time Range Boundaries**: Must include first and last data points for accurate range display
6. **"All" Time Range**: Must use monthly aggregation to preserve long-term trends

### Validation Tests

1. **Peak Accuracy Test**: Compare peak values from optimized vs. full dataset
2. **Average Accuracy Test**: Compare averages from optimized vs. full dataset (should be within 2%)
3. **Chart Quality Test**: Verify charts render smoothly with sampled data
4. **Current Stats Test**: Verify current player count matches live data
5. **Time Range Test**: Verify all time ranges show correct data boundaries

## Testing Strategy

1. Monitor memory usage before/after each phase
2. Load test with realistic data volumes
3. Verify cache hit rates remain acceptable
4. Ensure response times don't degrade significantly
5. Test with production-like data volumes (100k+ records)
6. **Data Quality Tests**: Verify peak, average, and current stats match full dataset
7. **Chart Quality Tests**: Verify all time ranges render correctly with sampled data
8. **Regression Tests**: Ensure no existing functionality breaks
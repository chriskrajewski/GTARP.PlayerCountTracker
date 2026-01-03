# Product Requirements Document: Twitch Clips Aggregation

> **Traceability Note:** This PRD uses section numbers (§1-§10) that are referenced by the Technical Blueprint and Task List. All user answers have been mapped to specific sections.

## §1. Overview & Vision

This feature enables users to discover and view Twitch clips from streamers who have previously streamed on a particular GTA RP server. By aggregating clips through an automated ETL pipeline, the application provides a curated library of content that showcases server gameplay, memorable moments, and streamer highlights. The feature integrates seamlessly with existing server statistics, following established patterns for data collection, API design, and user interface components.

**Key Outcomes:**
- Automated collection and storage of Twitch clips from relevant streamers
- Historical tracking of which streamers have played on each server
- User-friendly clip browsing with filtering by streamer
- Consistent integration with existing streams and server statistics features
- Performance-optimized API and UI following established patterns

## §2. Problem Statement

Server communities want to promote and share engaging gameplay content, but there's currently no way to discover clips from streamers who play on their server. Users must manually search Twitch for clips, not knowing which streamers to follow or which clips feature their favorite servers.

**Current Pain Points:**
- No centralized location to discover clips from streamers associated with a server
- Manual effort required to track which streamers play on which servers
- Missing content discovery mechanism for community highlights and memorable moments
- Inconsistent visibility into server gameplay beyond live streams
- Lack of historical tracking for streamer-server relationships

## §3. Target Users

| User Type | Needs | Key Actions |
|-----------|-------|-------------|
| Server Community Members | Discover clips featuring their favorite server | Browse clips, filter by streamer, watch in modal player |
| Server Administrators | Promote community content and engagement | Access clips feature from server stats, share clips with community |
| Casual Viewers | Find entertaining GTA RP content | View clip thumbnails, filter by views/duration, watch popular clips |
| Streamer Fans | Follow specific streamers across servers | Filter clips by their favorite streamers, discover new content |

## §4. Core Requirements

### §4.1 Functional Requirements

| ID | Requirement | Priority | Source |
|----|-------------|----------|--------|
| FR-1 | System shall fetch clips from Twitch Clips API for streamers with historical server association | High | Original request, Q5, Q6 |
| FR-2 | System shall track streamer-server relationships in dedicated history table | High | Original request, Q2 |
| FR-3 | System shall accumulate clips over time without deletion (append-only) | High | Q3 |
| FR-4 | System shall run ETL process on scheduled interval to collect new clips | High | Original request, Q4 |
| FR-5 | System shall match clips using stream_search_config keywords (title, tags, category) | High | Original request |
| FR-6 | System shall validate clip URLs regularly and mark invalid clips | High | Q8 |
| FR-7 | System shall provide API endpoint at /api/clips/[serverId] for clip retrieval | High | Q9 |
| FR-8 | System shall support filtering clips by streamer | High | Original request, Q16 |
| FR-9 | System shall display clips in grid layout with cards showing title, thumbnail, views, duration | High | Q13, Q16 |
| FR-10 | System shall provide modal player for viewing individual clips with Twitch embed | High | Q13 |
| FR-11 | System shall add "Clips" button to server-stats-card component next to "Streams" button | High | Q15 |
| FR-12 | System shall load clips data immediately when page opens | High | Q14 |

### §4.2 Non-Functional Requirements

| ID | Category | Requirement | Source |
|----|----------|-------------|--------|
| NFR-1 | Performance | API responses shall be cached with same TTL as streams API | Q10 |
| NFR-2 | Performance | Database queries shall use optimized views for aggregations following established patterns | Q1 |
| NFR-3 | Performance | Clip validity checks shall run asynchronously without blocking user requests | Q8 |
| NFR-4 | Scalability | ETL process shall paginate Twitch API requests to handle high-volume streamers | Q6 |
| NFR-5 | Reliability | API shall apply same rate limiting as existing stream endpoints | Q7 |
| NFR-6 | Reliability | API shall return consistent error messages and codes following existing patterns | Q11 |
| NFR-7 | Security | Twitch API authentication shall reuse existing OAuth token management | Q5 |
| NFR-8 | Maintainability | System shall follow existing database patterns (direct SQL + views) | Q1 |
| NFR-9 | Usability | Clip response format shall be simple and clean (no technical IDs exposed) | Q12, Q16 |
| NFR-10 | Usability | UI shall follow existing grid + cards + modal pattern from server-streams component | Q13 |

## §5. User Stories & Acceptance Criteria

### Epic 1: Clip Data Collection & Storage

#### Story §5.1: Automated Clip Fetching
**As a** system administrator
**I want** clips to be automatically collected from Twitch on a schedule
**So that** users always have access to recent content without manual intervention

**Acceptance Criteria:**
- [ ] §5.1.1: Edge Function runs on scheduled interval (hourly recommended) to fetch clips
- [ ] §5.1.2: For each server, system queries streamer_server_history table for associated streamers
- [ ] §5.1.3: System fetches clips from Twitch Clips API for each streamer using OAuth token
- [ ] §5.1.4: Pagination is implemented to fetch multiple pages of results per streamer
- [ ] §5.1.5: Clips are filtered based on stream_search_config keywords (title, tags, category)
- [ ] §5.1.6: Matched clips are inserted into twitch_clips table with deduplication
- [ ] §5.1.7: ETL process logs success/failure metrics for monitoring

#### Story §5.2: Streamer History Tracking
**As a** system
**I want** to automatically track which streamers have played on each server
**So that** the clips feature knows which streamers to monitor

**Acceptance Criteria:**
- [ ] §5.2.1: When live stream ETL runs, matching streamers are recorded in streamer_server_history
- [ ] §5.2.2: History table stores serverId, streamer username, platform (twitch), first_seen, last_seen timestamps
- [ ] §5.2.3: Duplicate entries are prevented (unique constraint on serverId + username + platform)
- [ ] §5.2.4: Last_seen timestamp is updated each time streamer is detected live on that server
- [ ] §5.2.5: History table is indexed for efficient lookup by serverId

#### Story §5.3: Clip Validity Management
**As a** system administrator
**I want** invalid/deleted clips to be detected and marked
**So that** users don't encounter broken video embeds

**Acceptance Criteria:**
- [ ] §5.3.1: Scheduled process checks clip URLs for validity (HTTP 200 response)
- [ ] §5.3.2: Invalid clips are marked with is_valid = false flag in database
- [ ] §5.3.3: API endpoint filters out invalid clips from results by default
- [ ] §5.3.4: Validation runs asynchronously without blocking clip fetching or API responses
- [ ] §5.3.5: Validation frequency is configurable (daily recommended)

### Epic 2: Clip Data Access

#### Story §5.4: Clips API Endpoint
**As a** frontend developer
**I want** a consistent API to fetch clips for a server
**So that** I can display clips in the UI following existing patterns

**Acceptance Criteria:**
- [ ] §5.4.1: Endpoint exists at /api/clips/[serverId] following existing route pattern
- [ ] §5.4.2: Response includes array of clips with: title, thumbnail_url, embed_url, view_count, duration, streamer_name, created_at
- [ ] §5.4.3: Optional query parameter ?streamer=[username] filters results by specific streamer
- [ ] §5.4.4: Results are sorted by view_count DESC by default
- [ ] §5.4.5: Responses are cached with same TTL as streams API (using lib/api-cache.ts)
- [ ] §5.4.6: Rate limiting is applied consistent with other live data endpoints
- [ ] §5.4.7: Error responses follow existing format (status codes, message structure)
- [ ] §5.4.8: Invalid serverId returns 404 with clear message
- [ ] §5.4.9: Database errors return 500 with logged details

### Epic 3: Clip Discovery UI

#### Story §5.5: Clips Page Access
**As a** server community member
**I want** to easily navigate to clips for my server
**So that** I can discover engaging content

**Acceptance Criteria:**
- [ ] §5.5.1: "Clips" button appears on server-stats-card footer next to "Streams" button
- [ ] §5.5.2: Button styling matches existing "Streams" button for consistency
- [ ] §5.5.3: Clicking button navigates to /clips/[serverId] page
- [ ] §5.5.4: Button includes clip icon (matching design system)
- [ ] §5.5.5: Button is visible and clickable on both desktop and mobile layouts

#### Story §5.6: Clips Grid Display
**As a** user browsing clips
**I want** to see clips in an attractive grid layout
**So that** I can quickly scan and select content to watch

**Acceptance Criteria:**
- [ ] §5.6.1: Page immediately fetches clips data when opened (no manual trigger)
- [ ] §5.6.2: Loading skeletons display while data is fetching
- [ ] §5.6.3: Clips display in responsive grid (same pattern as server-streams component)
- [ ] §5.6.4: Each clip card shows: thumbnail, title, streamer name, view count, duration
- [ ] §5.6.5: Technical IDs and internal metadata are not exposed to users
- [ ] §5.6.6: Cards have hover effects for interactivity
- [ ] §5.6.7: Empty state displays when no clips exist for server
- [ ] §5.6.8: Error state displays if API request fails

#### Story §5.7: Streamer Filtering
**As a** user interested in specific streamers
**I want** to filter clips by streamer
**So that** I can find content from my favorite creators

**Acceptance Criteria:**
- [ ] §5.7.1: Dropdown/select component lists all streamers with clips for this server
- [ ] §5.7.2: "All Streamers" option shows all clips (default)
- [ ] §5.7.3: Selecting a streamer filters grid to show only their clips
- [ ] §5.7.4: Streamer filter state persists in URL query parameter
- [ ] §5.7.5: Filter updates are reflected in URL (shareable links)
- [ ] §5.7.6: Streamer count displays in filter UI (e.g., "Streamer (23 clips)")

#### Story §5.8: Clip Playback
**As a** user
**I want** to watch clips in a modal player
**So that** I can view content without leaving the page

**Acceptance Criteria:**
- [ ] §5.8.1: Clicking clip card opens modal with Twitch embed player
- [ ] §5.8.2: Modal displays clip title, streamer name, view count, created date
- [ ] §5.8.3: Modal includes close button and backdrop click to dismiss
- [ ] §5.8.4: Twitch embed player is properly configured with clip ID
- [ ] §5.8.5: CSP headers allow Twitch embed domains (clips.twitch.tv, player.twitch.tv)
- [ ] §5.8.6: Modal is keyboard accessible (ESC to close, tab navigation)
- [ ] §5.8.7: Multiple clips can be selected and queued (following streams pattern if applicable)

## §6. User Experience Contract
*→ Extracted into Blueprint §1.5/1.6 User Journey diagrams*

### §6.1 User Visibility Specification

| ID | User Action | User Sees (Exact) | User Does NOT See | Timing |
|----|-------------|-------------------|-------------------|--------|
| V-1 | Navigate to /clips/[serverId] | Loading skeletons in grid layout | Database queries, API fetch internals | Immediate |
| V-2 | Clips data loads successfully | Grid of clip cards with thumbnails, titles, views, duration | Clip IDs, database timestamps, internal metadata | 200-500ms |
| V-3 | No clips exist for server | Empty state message: "No clips available for this server yet" | Database null results, empty array responses | After loading |
| V-4 | API request fails | Error state: "Unable to load clips. Please try again." | Error stack traces, database errors, API error details | After timeout |
| V-5 | Select streamer from filter | Filtered grid showing only selected streamer's clips | API request to refetch data, URL query parameter update | Immediate |
| V-6 | Click clip card | Modal opens with Twitch embed player, clip details | Embed URL construction, CSP configuration | Immediate |
| V-7 | Clip embed loads | Twitch player with clip video | Twitch API authentication, embed domain configuration | 100-300ms |
| V-8 | Click "Clips" button on stats card | Navigation to clips page | Route resolution, Next.js page loading | Immediate |
| V-9 | Hover over clip card | Visual hover effect (scale, shadow, border) | CSS state changes, no network requests | Immediate |
| V-10 | Close clip modal | Return to grid view, modal dismissed | Modal state cleanup, player unload | Immediate |

### §6.2 Timing & Feedback Expectations

| ID | Event | Expected Timing | User Feedback | Failure Feedback |
|----|-------|-----------------|---------------|------------------|
| T-1 | Page load (initial) | < 500ms | Loading skeletons display | "Failed to connect" error after 10s |
| T-2 | Clips data fetch | 200-500ms | Skeletons replaced with clip cards | Error state with retry button |
| T-3 | Streamer filter applied | < 100ms (instant) | Grid re-renders with filtered clips | No failure expected (client-side filter) |
| T-4 | Modal open | < 50ms (instant) | Modal slides in with clip details | No failure expected (UI only) |
| T-5 | Twitch embed load | 300-1000ms | Loading spinner in embed area | "Video unavailable" message if embed fails |
| T-6 | "Clips" button click | < 50ms (instant) | Navigation begins, page loads | Browser standard navigation error |
| T-7 | ETL process (background) | N/A (user unaware) | No user-facing feedback | Logged to monitoring, no user notification |
| T-8 | Clip validity check (background) | N/A (user unaware) | Invalid clips silently filtered from results | Logged to monitoring, no user notification |

## §7. Artifact Ownership
*→ Extracted into Blueprint §2 System Boundaries*

### §7.1 Creation Responsibility

| ID | Artifact | Created By | When | App's Role |
|----|----------|------------|------|------------|
| O-1 | Twitch clips (video content) | Twitch platform | User creates clip on Twitch | Observe (discover via API) |
| O-2 | Clip metadata records | This application (ETL) | Scheduled interval (hourly) | Create (insert into twitch_clips table) |
| O-3 | Streamer history records | This application (stream ETL) | When live stream detected | Create (insert/update streamer_server_history) |
| O-4 | Stream search config rules | Server administrators | Via admin interface | Observe (read from stream_search_config table) |
| O-5 | Twitch OAuth tokens | This application | On app startup or token expiry | Create (via Client Credentials grant) |
| O-6 | Clip validity flags | This application (validation process) | Scheduled validation runs | Create (update is_valid flag) |
| O-7 | Cached API responses | This application (API routes) | On first request after cache miss | Create (using lib/api-cache.ts) |
| O-8 | Clip embed URLs | Constructed by application | When rendering clip modal | Create (transform clip ID into embed URL) |

### §7.2 External System Dependencies

| ID | External System | What It Creates | How App Knows | Failure Handling |
|----|-----------------|-----------------|---------------|------------------|
| E-1 | Twitch Clips API | Clip metadata (title, URL, views, creator) | HTTP GET request with OAuth token | Retry with exponential backoff, log failure, continue with next streamer |
| E-2 | Twitch OAuth Service | Access tokens | HTTP POST to token endpoint | Retry once, if fail, abort ETL run and alert |
| E-3 | Twitch Embed Service | Video player iframe | Embed URL loads in modal | Display "Video unavailable" message, offer refresh button |
| E-4 | Supabase Database | Query results, insert confirmations | Database driver response | Return 500 error to user, log error with context, retry transient errors |
| E-5 | Stream Search Config | Keyword matching rules | Query stream_search_config table | Use empty rules (no filtering) if config missing for server |

### §7.3 Derived Ownership Rules
*These become Blueprint §2.3 Boundary Rules*

| Source | Rule | Rationale |
|--------|------|-----------|
| O-1 | App must NOT create or modify Twitch clip videos | Twitch platform creates clips, app only references them |
| O-2 | App must NOT delete clip metadata records | Accumulate-over-time strategy (Q3), only mark as invalid |
| O-4 | App must NOT modify stream_search_config during ETL | Config is admin-managed, ETL is read-only consumer |
| E-1 | App must handle clip API returning empty results | Not all streamers have clips, this is normal operation |
| E-2 | App must abort ETL if OAuth token cannot be obtained | Cannot fetch clips without valid authentication |
| E-3 | App must NOT assume all clips will embed successfully | Twitch may delete clips, app should handle gracefully |
| E-4 | App must NOT expose database errors to end users | Security: hide internal details, show generic error message |
| O-6 | App must periodically validate clips before serving | URLs can break over time, validation ensures quality |

## §8. State Requirements
*→ Extracted into Blueprint §3 State Transition Specifications*

### §8.1 State Isolation

| ID | Requirement | Rationale | Enforcement |
|----|-------------|-----------|-------------|
| SI-1 | Clips for different servers must be independently queryable | Users viewing Server A clips should not see Server B data | Database: serverId foreign key + indexed lookups; API: serverId path parameter |
| SI-2 | Streamer filter state must not affect other users | Each user's filter choice is personal to their session | Client-side: React state + URL query parameter (no server persistence) |
| SI-3 | ETL process for one server must not block others | Clip fetching for popular Server A shouldn't delay Server B | Edge Function: iterate servers sequentially but handle errors independently |
| SI-4 | Clip validity checks must not interfere with serving clips | Validation running in background should not slow down API responses | Separate validation process, API reads current is_valid flag without blocking |
| SI-5 | Cached responses must be scoped to serverId | Server A clip cache should not return Server B clips | Cache key includes serverId parameter |

### §8.2 State Lifecycle

| ID | State | Initial | Created When | Cleared When | Persists Across |
|----|-------|---------|--------------|--------------|------------------|
| SL-1 | Clip metadata records | N/A | ETL process fetches new clips from Twitch | Never deleted, only marked invalid | Permanent (database) |
| SL-2 | Streamer history records | N/A | Live stream ETL detects streamer on server | Never deleted, last_seen updated | Permanent (database) |
| SL-3 | Clip validity flag (is_valid) | true | Clip inserted into database | Set to false when validation fails | Permanent until revalidated |
| SL-4 | Twitch OAuth token | null | App startup or token expiry | On token expiry (typically 60 days) | In-memory cache |
| SL-5 | API response cache | null | First request for serverId after cache miss | After TTL expires (same as streams: 30s) | In-memory (api-cache.ts) |
| SL-6 | Client: Clips data array | [] | Component mounts, API fetch completes | Component unmounts or navigates away | React state (single page session) |
| SL-7 | Client: Selected streamer filter | "all" | User selects from dropdown | Component unmounts or user changes filter | React state + URL query |
| SL-8 | Client: Modal open state | false | User clicks clip card | User closes modal or navigates away | React state (single session) |
| SL-9 | Client: Selected clip for modal | null | User clicks clip card | Modal closes | React state (single session) |
| SL-10 | Client: Loading state | true | Component mounts, fetch begins | Data arrives or error occurs | React state (single session) |

## §9. Technical Considerations
*→ Informs Blueprint §5, §6, §9, §11*

### §9.1 Architecture Decisions

- **Follow existing ETL pattern**: Reuse the getTwitchStreamData.ts Edge Function architecture for the clips ETL. Create a new Edge Function getClipsData.ts with similar structure (Twitch OAuth, pagination, keyword matching, Supabase insert). This ensures consistency and leverages proven code patterns.

- **Database schema mirrors streams pattern**: Create twitch_clips table following twitch_streams structure with columns: id, created_at, clip_id, streamer_name, clip_title, view_count, duration, thumbnail_url, embed_url, serverId, is_valid. Create streamer_server_history table with: id, serverId, streamer_username, platform, first_seen, last_seen. Add database views for aggregations (clip counts, top streamers).

- **API route mirrors streams route**: New /api/clips/[serverId]/route.ts should follow the structure of /api/streams/[serverId]/route.ts including rate limiting (next-rate-limit), caching (lib/api-cache.ts), error handling, and response format.

- **UI component extends streams component**: Create components/server-clips.tsx following server-streams.tsx pattern with grid layout, clip cards, streamer filter dropdown, modal player, loading skeletons. Reuse existing UI components (Card, Button, Modal, Select) from the design system.

- **Clip validity as async background process**: Implement as separate scheduled Edge Function validateClips.ts that checks clip URLs (HTTP HEAD request) and updates is_valid flag. Runs daily, does not block ETL or API responses.

### §9.2 Integration Points

- **Existing Twitch OAuth management**: Clips ETL will call the same getTwitchAccessToken() function used by live stream ETL, reusing token caching and refresh logic from lib/twitch-api.ts (or equivalent).

- **Existing stream_search_config matching**: Clips ETL will call getStreamSearchConfigMap() from lib/stream-config.ts to retrieve keyword rules per server, applying same matching logic as live stream detection.

- **Existing streamer_server_history table**: Live stream ETL (getTwitchStreamData.ts) must be updated to write to streamer_server_history whenever a match is found. Clips ETL reads from this table to know which streamers to query.

- **Existing server-stats-card UI**: Add new "Clips" button in the footer section alongside "Streams" button. Button navigates to /clips/[serverId] page using Next.js Link component.

- **Existing CSP configuration**: Update next.config.mjs Content-Security-Policy headers to include Twitch clip domains in img-src (thumbnail images) and frame-src (embed player).

- **Existing API caching layer**: Import and use createCachedHandler from lib/api-cache.ts in the clips API route, following the same pattern as streams API.

### §9.3 Constraints

- **Twitch API rate limits**: Helix API allows 800 requests per minute per client_id. With pagination (100 clips per page) and multiple streamers, ETL could hit limits for servers with many active streamers. Implement request throttling and respect rate limit headers.

- **Clip availability**: Twitch clips can be deleted by creators or Twitch moderation. The is_valid flag mechanism mitigates this, but UI must gracefully handle embeds that fail to load.

- **Database storage growth**: Accumulating clips over time (no deletion) means twitch_clips table will grow indefinitely. Monitor table size and consider archival strategy for clips older than 6-12 months if storage becomes an issue.

- **ETL scheduling frequency**: Running every hour provides good freshness without excessive API usage. More frequent runs (e.g., every 15 minutes) would increase API costs and risk rate limiting.

- **Search config coverage**: Clips will only be collected for servers that have stream_search_config rules defined. Servers without config will have no clips. Ensure all active servers have config entries.

- **Authentication dependency**: If Twitch OAuth token cannot be obtained, entire clips ETL fails. Implement monitoring and alerting for authentication failures.

- **Next.js image optimization**: Twitch clip thumbnail URLs must be added to next.config.mjs remotePatterns to enable Next.js Image component optimization (optional but recommended for performance).

## §10. Success Metrics
*→ Informs Blueprint §10 Testing Strategy*

| ID | Metric | Target | Measurement Method |
|----|--------|--------|--------------------|
| M-1 | ETL process success rate | > 95% successful runs | Monitor Edge Function logs, count successful vs failed executions per day |
| M-2 | Clip data freshness | Clips within 1 hour of creation appear in app | Compare clip created_at timestamp with database inserted_at timestamp |
| M-3 | API response time | p95 < 500ms | Monitor /api/clips/[serverId] response times via logging or APM |
| M-4 | Clip validity rate | > 90% of clips marked as valid | Query database: COUNT(is_valid=true) / COUNT(*) ratio |
| M-5 | User engagement | Users click into clips page from stats cards | Track /clips/[serverId] page views via analytics |
| M-6 | Clip playback success | > 95% of modal opens result in successful embed | Track Twitch embed errors via console logging or error boundaries |
| M-7 | Streamer coverage | > 80% of servers have at least 1 streamer in history | Query streamer_server_history: COUNT(DISTINCT serverId) / COUNT(servers) |
| M-8 | Cache hit rate | > 70% of API requests served from cache | Monitor api-cache.ts hit/miss ratio |
| M-9 | Error rate | < 1% of API requests return 500 errors | Monitor error logs and status code distribution |
| M-10 | Pagination completeness | Average clips per streamer > 50 | Indicates multi-page fetching is working (single page = 20-100 clips) |

---

## Appendix A: Answer Traceability

| User Answer (Summary) | Captured In |
|-----------------------|-------------|
| Q1: Same database pattern (direct SQL + views) | §4.2-NFR-8, §9.1 Architecture |
| Q2: Create new history table | §4.1-FR-2, §5.2, §7.1-O-3, §8.2-SL-2, §9.1 Architecture |
| Q3: Accumulate clips over time | §4.1-FR-3, §7.3, §8.2-SL-1, §9.3 Constraints |
| Q4: App manages everything | §4.1-FR-4, §5.1, §7.1-O-2, §7.1-O-6 |
| Q5: Same OAuth token approach | §4.2-NFR-7, §5.1.3, §7.1-O-5, §7.2-E-2, §9.2 Integration |
| Q6: Same pagination pattern (fetch multiple pages) | §4.2-NFR-4, §5.1.4, §9.3 Constraints, §10-M-10 |
| Q7: Same rate limiting | §4.2-NFR-5, §5.4.6, §9.1 Architecture, §9.3 Constraints |
| Q8: Check clip validity regularly | §4.1-FR-6, §4.2-NFR-3, §5.3, §7.1-O-6, §8.2-SL-3, §9.1 Architecture |
| Q9: Same API pattern (/api/clips/[serverId]) | §4.1-FR-7, §5.4, §9.1 Architecture |
| Q10: Cache clip responses | §4.2-NFR-1, §5.4.5, §8.1-SI-5, §8.2-SL-5, §9.2 Integration, §10-M-8 |
| Q11: Same error messages and codes | §4.2-NFR-6, §5.4.7-9, §7.3, §9.1 Architecture |
| Q12: Simple, clean response | §4.2-NFR-9, §5.4.2, §6.1-V-2 |
| Q13: Same grid + cards + modal pattern | §4.1-FR-9, FR-10, §4.2-NFR-10, §5.6, §5.8, §6.1-V-6, §9.1 Architecture |
| Q14: Load data when page opens | §4.1-FR-12, §5.6.1, §6.1-V-1, §6.2-T-1 |
| Q15: Add "Clips" button next to "Streams" | §4.1-FR-11, §5.5, §6.1-V-8, §9.2 Integration |
| Q16: Simple clip info (title, thumbnail, views, duration) | §4.1-FR-9, §4.2-NFR-9, §5.6.4, §6.1-V-2 |

**Validation:** ✅ All user answers have been captured. No information lost.

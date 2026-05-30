# Implementation Plan: Streamer Character Tracking

## Overview

This plan implements the approved design bottom-up so each step builds on the
previous one with no orphaned code. Order: (1) SQL migrations + the fail-closed
feature flag constant, (2) the pure derivation core (name normalization +
identity, then session/catalog/clip-association functions), (3) the
Character_Extractor (injectable AI client + deterministic heuristic fallback),
(4) the Data_Layer async reads, (5) processing + admin actions, (6) the API
routes, (7) the UI components, and finally (8) wiring into the Streamer_Profile
page and the admin page, ending with lint + type-check + the full test suite.

All new code is TypeScript and lives in the files named in the design:
`lib/character-extractor.ts`, `lib/streamer-characters.ts`,
`lib/feature-flags-constants.ts`, `app/api/streamers/characters/route.ts`,
`app/api/admin/characters/route.ts`, `components/streamers/character-catalog.tsx`,
`components/streamers/character-clips-panel.tsx`,
`components/admin/character-review-queue.tsx`, the SQL files under `api2db/sql/`,
and the profile page / `streamer-profile-view.tsx` wiring.

The 24 Correctness Properties are implemented as `fast-check` property-based
tests in `__tests__/character-extractor.test.ts` and
`__tests__/streamer-characters.test.ts`, each running the enforced 100-iteration
floor via `assertProperty` / `assertPropertyAsync` from `__tests__/pbt-helpers.ts`,
with generators added to `__tests__/arbitraries.ts`. Every property test carries
the tag comment `// Feature: streamer-character-tracking, Property {n}: {text}`.

## Tasks

- [x] 1. Feature flag constant and database migrations
  - [x] 1.1 Add the `CHARACTER_TRACKING` flag to `lib/feature-flags-constants.ts`
    - Add `CHARACTER_TRACKING: 'character_tracking'` to the `FEATURE_FLAGS` object
    - Add `FEATURE_FLAGS.CHARACTER_TRACKING` to the `FAIL_CLOSED_FLAGS` set so it fails closed
    - _Requirements: 1.1, 1.4_

  - [x] 1.2 Create the `character_extractions` table migration
    - Create `api2db/sql/create_character_extractions.sql` exactly per the design Data Models section: `create table if not exists`, `streamer_name`, `source_title`, nullable `character_name`, `confidence numeric(4,3)` with 0–1 check, `extraction_method` check (`'ai'|'fallback'`), `review_state` check (`'pending'|'confirmed'|'overridden'|'rejected'`) default `'pending'`, `override_name`, `reviewed_by`, `reviewed_at`
    - Add the unique index `uq_char_extractions_streamer_title` on `(lower(streamer_name), source_title)` (idempotency key), the `idx_char_extractions_streamer` lookup index, and the partial `idx_char_extractions_review` index
    - Enable row-level security with NO public SELECT policy (service-role reads only)
    - _Requirements: 2.7, 2.8, 8.2, 9.3_

  - [x] 1.3 Create the feature-flag seed migration
    - Create `api2db/sql/add_character_tracking_feature_flag.sql` mirroring `api2db/sql/add_site_feature_enhancement_flags.sql`: register `character_tracking` disabled by default with `ON CONFLICT ... DO UPDATE` that never overwrites `is_enabled`
    - _Requirements: 1.1, 1.3_

  - [ ]* 1.4 Write unit test for flag membership (R1.1)
    - In `__tests__/streamer-characters.test.ts`, assert `FEATURE_FLAGS.CHARACTER_TRACKING === 'character_tracking'` and that `FAIL_CLOSED_FLAGS.has(FEATURE_FLAGS.CHARACTER_TRACKING)` is true
    - _Requirements: 1.1_

- [x] 2. Pure name normalization and character identity
  - [x] 2.1 Implement `normalizeCharacterName` and `charactersEqual`
    - Create `lib/character-extractor.ts` with `ExtractionMethod`, `CharacterExtractionResult`, and the `AiExtractionSchema` zod schema
    - Implement `normalizeCharacterName(raw)`: trim, collapse internal whitespace runs to single ASCII spaces, preserve case, return `''` when empty after normalization (idempotent)
    - Implement `charactersEqual(a, b)`: case-insensitive comparison over normalized names
    - _Requirements: 2.5, 2.6_

  - [x] 2.2 Add name-generation arbitraries
    - In `__tests__/arbitraries.ts` add `whitespaceVariantArbitrary` (leading/trailing/internal whitespace runs + mixed case) and `titleArbitrary` (realistic GTA RP titles with embedded names, delimiters `| - – • / :`, noise tags, emoji, unicode)
    - _Requirements: 2.5, 2.6_

  - [ ]* 2.3 Write property test for name normalization
    - In `__tests__/character-extractor.test.ts`
    - `// Feature: streamer-character-tracking, Property 5: For any string, normalizeCharacterName returns a value with no leading or trailing whitespace and no internal run of more than one whitespace character, and normalization is idempotent (normalize(normalize(x)) === normalize(x)).`
    - **Property 5: Name normalization** — **Validates: Requirements 2.5**

  - [ ]* 2.4 Write property test for case-insensitive character identity
    - `// Feature: streamer-character-tracking, Property 6: For any two strings whose normalized forms are equal under case-insensitive comparison, charactersEqual returns true, and title records yielding such names for the same streamer collapse into a single catalog character.`
    - **Property 6: Case-insensitive character identity** — **Validates: Requirements 2.6**

- [x] 3. Pure derivation core (sessions, catalog, clip association)
  - [x] 3.1 Implement domain types and `resolveEffectiveCharacter`
    - Create `lib/streamer-characters.ts` with `ReviewState`, `StoredExtraction`, `CharacterPlaySession`, `CharacterCatalogEntry`, `ReviewQueueItem`, `ResolvedTitleRecord` types (reuse `Clip`/`StreamerPlatform` from `lib/streamers.ts`)
    - Implement `resolveEffectiveCharacter(e)`: `rejected`/`pending` → `null`; `confirmed`/`overridden` → normalized `overrideName ?? characterName` (or `null` when empty)
    - _Requirements: 6.4, 6.5_

  - [x] 3.2 Implement `deriveCharacterPlaySessions`
    - Sort records ascending by `(timestamp, id)`; build half-open, gap-capped slabs `[t_k, min(t_{k+1}, t_k + SESSION_TAIL_MS))` (default `SESSION_TAIL_MS = 10*60*1000`); merge consecutive contiguous same-character slabs into one session; `null` records break runs and contribute no slab; set `start = t_first`, `end = slab_last.end`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 3.3 Implement `buildCharacterCatalog` and `associateClipToCharacter`
    - `buildCharacterCatalog(sessions, clipsByCharacter)`: one entry per distinct character, `firstSeen = min start`, `lastSeen = max end`, `sourceTitleCount`, `clipCount`, ordered by `lastSeen` descending
    - `associateClipToCharacter(clipCreatedAt, sessions)`: return the character of the unique session whose half-open `[start, end)` contains the timestamp, else `null`
    - Add a pure VOD-overlap helper `vodCharactersByOverlap(vodStart, vodEnd, sessions)` returning the distinct characters whose session interval overlaps `[vodStart, vodEnd)` (seam for R7; no VOD source consumed yet)
    - _Requirements: 3.1, 3.2, 3.3, 5.1, 5.2, 5.3, 7.1_

  - [x] 3.4 Add derivation arbitraries
    - In `__tests__/arbitraries.ts` add `resolvedRecordsArbitrary` (time-ordered records with characters, `null` separators, duplicate timestamps, gap variety), `clipArbitrary` (timestamps inside/between/outside sessions, varied `viewCount` incl. ties), and `vodIntervalArbitrary` (overlapping/disjoint intervals)
    - _Requirements: 4.1, 4.2, 5.1, 5.4, 7.1_

  - [ ]* 3.5 Write property test: catalog distinct and confirmed-only
    - `// Feature: streamer-character-tracking, Property 8: For any set of derived sessions, buildCharacterCatalog produces entries with pairwise-distinct character names, and every catalog character corresponds to an effective (confirmed/overridden, non-null) character — no pending or rejected extraction appears.`
    - **Property 8: Catalog characters are distinct and confirmed-only** — **Validates: Requirements 3.1**

  - [ ]* 3.6 Write property test: catalog ordering and most-recent date
    - `// Feature: streamer-character-tracking, Property 9: For any set of derived sessions, the catalog is ordered by lastSeen descending (most recently played first), and each entry's lastSeen equals the maximum session end across that character's sessions.`
    - **Property 9: Catalog ordering and most-recent date** — **Validates: Requirements 3.2, 3.3**

  - [ ]* 3.7 Write property test: sessions cover their records
    - `// Feature: streamer-character-tracking, Property 10: For any time-ordered resolved title records, every record that resolves to a real (non-null) character is contained within exactly one session for that same character.`
    - **Property 10: Sessions cover their records** — **Validates: Requirements 4.1**

  - [ ]* 3.8 Write property test: session grouping and boundaries
    - `// Feature: streamer-character-tracking, Property 11: For any time-ordered resolved title records, consecutive records resolving to the same character within the gap cap are grouped into a single session, and any character change or excluded/null record ends the current session and starts a new session at the next real-character record.`
    - **Property 11: Session grouping and boundaries** — **Validates: Requirements 4.2, 4.3**

  - [ ]* 3.9 Write property test: session start precedes or equals end
    - `// Feature: streamer-character-tracking, Property 12: For any set of derived sessions, every session has start <= end.`
    - **Property 12: Session start precedes or equals end** — **Validates: Requirements 4.4**

  - [ ]* 3.10 Write property test: different-character sessions never overlap
    - `// Feature: streamer-character-tracking, Property 13: For any set of derived sessions for a single streamer, every pair of sessions belonging to different characters has disjoint time intervals.`
    - **Property 13: Different-character sessions never overlap** — **Validates: Requirements 4.5**

  - [ ]* 3.11 Write property test: clip-to-character association is exact
    - `// Feature: streamer-character-tracking, Property 14: For any set of clips and derived sessions, getClipsForCharacter(c) returns exactly the clips whose creation timestamp falls within a session of character c — no extras, no omissions.`
    - Exercise the pure `associateClipToCharacter` over `clipArbitrary` + `resolvedRecordsArbitrary`
    - **Property 14: Clip-to-character association is exact** — **Validates: Requirements 5.1, 5.2, 5.3, 3.5**

  - [ ]* 3.12 Write property test: idempotent catalog and sessions
    - `// Feature: streamer-character-tracking, Property 23: For any set of title records and admin corrections, processing them more than once with unchanged titles and corrections yields a Character_Catalog and set of Character_Play_Sessions identical to processing them once (derive(x) === derive(derive(x))).`
    - Assert pure determinism of `deriveCharacterPlaySessions` + `buildCharacterCatalog`
    - **Property 23: Idempotent catalog and sessions** — **Validates: Requirements 9.4, 6.6**

  - [ ]* 3.13 Write property test: VOD overlap association is exact
    - `// Feature: streamer-character-tracking, Property 24: For any set of VOD intervals and derived sessions, a VOD is associated with exactly the characters whose session intervals overlap the VOD's interval.`
    - Tested against the pure `vodCharactersByOverlap` helper; end-to-end remains pending until a VOD source exists
    - **Property 24: VOD overlap association is exact** — **Validates: Requirements 7.1, 7.2**

  - [ ]* 3.14 Write unit tests for derivation edge cases
    - Single title record (one session, `start < end`); all-`null` records (no sessions); clip exactly on a session boundary (half-open `[start, end)` excludes `end`); `viewCount` ties stable
    - _Requirements: 4.1, 4.4, 5.1, 5.4_

- [x] 4. Checkpoint - pure core
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Character_Extractor (AI Gateway + heuristic fallback)
  - [x] 5.1 Implement the deterministic heuristic fallback
    - In `lib/character-extractor.ts`, implement `heuristicExtract(title)`: split on `| - – • / :`, discard noise segments (server names, `GTA`/`RP`/`NoPixel` tags, `!commands`, emoji-only), return the most plausible normalized segment with fixed modest confidence (default `0.4`) or `{ characterName: null }`
    - Define the `CharacterAiClient` interface and `buildExtractionPrompt(title)`
    - _Requirements: 2.1, 2.4, 2.5_

  - [x] 5.2 Implement `extractCharacterFromTitle` with the AI Gateway path
    - Call the configured OpenAI model through the AI Gateway (`generateObject` + `gateway(MODEL_ID)`) validated by `AiExtractionSchema`; on thrown error, schema-validation failure, or unusable output, fall back to `heuristicExtract` and set `method: 'fallback'`; clamp confidence into `[0,1]`; always return a normalized `characterName`; default the AI client from env (`AI_GATEWAY_MODEL`) when none injected
    - Document the new env vars in `env.sample` (`AI_GATEWAY_API_KEY`, `AI_GATEWAY_MODEL`, `CHARACTER_CONFIDENCE_THRESHOLD`)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.7_

  - [ ]* 5.3 Write property test: extraction result is well-formed and complete
    - `// Feature: streamer-character-tracking, Property 2: For any stream title, the extractor's result has characterName equal to either null or a normalized non-empty string, together with a confidence, a method ('ai' or 'fallback'), and the original sourceTitle.`
    - Inject deterministic `CharacterAiClient` fakes over `titleArbitrary`
    - **Property 2: Extraction result is well-formed and complete** — **Validates: Requirements 2.1, 2.7**

  - [ ]* 5.4 Write property test: confidence is within range
    - `// Feature: streamer-character-tracking, Property 3: For any stream title and any (mocked) AI output — including out-of-range, missing, or invalid values — the confidence the extractor returns is within the inclusive range 0.0 to 1.0.`
    - **Property 3: Confidence is within range** — **Validates: Requirements 2.3**

  - [ ]* 5.5 Write property test: deterministic fallback on AI failure
    - `// Feature: streamer-character-tracking, Property 4: For any stream title, when the AI client throws or returns schema-invalid/unusable output, the extractor returns a well-formed result with method === 'fallback'.`
    - **Property 4: Deterministic fallback on AI failure** — **Validates: Requirements 2.4**

  - [ ]* 5.6 Write unit test: single AI call on new title, zero on reuse (R2.2)
    - With a spy `CharacterAiClient`, assert `extractCharacterFromTitle` invokes it exactly once for a new title (gateway path)
    - _Requirements: 2.2_

- [x] 6. Data_Layer async reads
  - [x] 6.1 Implement `getCharacterPlaySessions` and `getCharacterCatalog`
    - In `lib/streamer-characters.ts`, default to the service-role client, accept injectable `MinimalStreamerClient` + `now`; read `twitch_streams` titles + `character_extractions` with `escapeLikePattern` + `namesEqual` exact matching; resolve via `resolveEffectiveCharacter` then `deriveCharacterPlaySessions` / `buildCharacterCatalog`; log + return `[]` on error; short-circuit empty/whitespace usernames
    - _Requirements: 3.1, 3.2, 3.3, 4.1, 8.1, 8.3, 8.4_

  - [x] 6.2 Implement `getClipsForCharacter`
    - Read `twitch_clips` + `kick_clips` independently (per-source error isolation), map to `Clip`, associate by `associateClipToCharacter` against the streamer's sessions, return exactly the requested character's clips ordered by `viewCount` descending; log + return `[]` on error
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 8.1, 8.3, 8.4_

  - [x] 6.3 Implement `getCharacterReviewQueue`
    - Read `character_extractions` where `review_state = 'pending'` ordered by confidence, map to `ReviewQueueItem`; log + return `[]` on error
    - _Requirements: 6.1, 8.1, 8.4_

  - [ ]* 6.4 Write property test: clips ordered by view count descending
    - `// Feature: streamer-character-tracking, Property 15: For any set of clips associated with a selected character, the returned list is ordered by viewCount in non-increasing order.`
    - Inject a deterministic `MinimalStreamerClient` fake into `getClipsForCharacter`
    - **Property 15: Clips ordered by view count descending** — **Validates: Requirements 5.4**

  - [ ]* 6.5 Write property test: case-insensitive exact streamer matching
    - In `__tests__/streamer-characters.test.ts`; add `usernameCasingArbitrary` (case variants + `_`/`%` decoys) to `__tests__/arbitraries.ts`
    - `// Feature: streamer-character-tracking, Property 20: For any stored records and any query username, a record is attributed to the streamer only when its username equals the query case-insensitively; usernames differing in any character (including ones containing _ or %) are never attributed.`
    - **Property 20: Case-insensitive exact streamer matching** — **Validates: Requirements 8.3**

  - [ ]* 6.6 Write property test: reads fail safe
    - `// Feature: streamer-character-tracking, Property 21: For any Data_Layer read whose injected client returns an error, the function logs and returns a safe empty value ([] or null) without throwing.`
    - Cover `getCharacterCatalog`, `getCharacterPlaySessions`, `getClipsForCharacter`, `getCharacterReviewQueue`
    - **Property 21: Reads fail safe** — **Validates: Requirements 8.4**

- [x] 7. Data_Layer processing and admin actions
  - [x] 7.1 Implement `processStreamerTitles` (backfill + incremental)
    - Load existing `character_extractions` for the streamer; for each distinct `(streamer, title)` in `twitch_streams`, reuse the stored result when the title is unchanged (no AI call) and only call `extractCharacterFromTitle` for new/changed titles; upsert with `review_state` derived from `CHARACTER_CONFIDENCE_THRESHOLD` (default `0.7`); treat unique-constraint conflicts as "already processed"; return `{ processed, reused, aiCalls }`; log + skip per-title failures
    - _Requirements: 2.8, 6.1, 6.2, 9.1, 9.2, 9.3, 9.4_

  - [x] 7.2 Implement `applyAdminReview`
    - Handle `confirm` / `override` / `no-character` actions: set `review_state` to `confirmed`/`overridden`/`rejected`, store `override_name`, `reviewed_by`, `reviewed_at`; unknown `extractionId` or write error returns `{ success: false }` without mutating other rows; the next read re-derives sessions/clips (R6.6)
    - _Requirements: 6.3, 6.4, 6.5, 6.6_

  - [ ]* 7.3 Write property test: unchanged titles are not re-sent to the AI
    - `// Feature: streamer-character-tracking, Property 7: For any set of title records, processing them a second time with unchanged title text issues zero new AI extraction requests and returns the previously stored results.`
    - Spy `CharacterAiClient` + in-memory `MinimalStreamerClient` fake
    - **Property 7: Unchanged titles are not re-sent to the AI** — **Validates: Requirements 2.8, 9.3**

  - [ ]* 7.4 Write property test: confidence threshold partitions confirmation vs review
    - Add `extractionArbitrary` (full `[0,1]` confidence range, all review states) to `__tests__/arbitraries.ts`
    - `// Feature: streamer-character-tracking, Property 16: For any extraction result, when its confidence is below the Confidence_Threshold it is pending and appears in the review queue, and when at or above the threshold it is confirmed and does not appear in the review queue.`
    - **Property 16: Confidence threshold partitions confirmation vs review** — **Validates: Requirements 6.1, 6.2**

  - [ ]* 7.5 Write property test: confirm transition removes from queue
    - `// Feature: streamer-character-tracking, Property 17: For any pending extraction, applying an admin confirm action sets its review state to confirmed and the extraction no longer appears in the review queue.`
    - **Property 17: Confirm transition removes from queue** — **Validates: Requirements 6.3**

  - [ ]* 7.6 Write property test: override sets the confirmed effective name
    - `// Feature: streamer-character-tracking, Property 18: For any extraction and any non-empty override name, after an admin override, resolveEffectiveCharacter returns the normalized override name and the next catalog/session derivation reflects that name.`
    - **Property 18: Override sets the confirmed effective name** — **Validates: Requirements 6.4, 6.6**

  - [ ]* 7.7 Write property test: "no character" excludes the record from all sessions
    - `// Feature: streamer-character-tracking, Property 19: For any set of records, marking one record as "no character" (rejected) causes the next session derivation to treat it as a separator, so it is contained in no session for any character.`
    - **Property 19: "No character" excludes the record from all sessions** — **Validates: Requirements 6.5, 6.6**

  - [ ]* 7.8 Write property test: backfill processes exactly the unprocessed records
    - `// Feature: streamer-character-tracking, Property 22: For any set of title records of which some are already processed, processStreamerTitles extracts exactly the records not yet processed and leaves already-processed unchanged-title records untouched.`
    - **Property 22: Backfill processes exactly the unprocessed records** — **Validates: Requirements 9.1, 9.2**

- [x] 8. Checkpoint - Data_Layer
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Public character API route
  - [x] 9.1 Implement `app/api/streamers/characters/route.ts`
    - `GET ?username=&character=`: fail-closed gate returns `404` when `CHARACTER_TRACKING` is disabled (mirror `viewer-trend/route.ts`); `400` on missing/invalid params; on success return `{ success: true, clips, vods }` from `getClipsForCharacter` (and `[]` vods until a VOD source exists); `500` with generic message + server log on unexpected error; export `dynamic = 'force-dynamic'`; read only through the Data_Layer (R8.1)
    - _Requirements: 1.2, 1.4, 5.2, 7.4, 8.1_

  - [ ]* 9.2 Write integration tests for the public route
    - `404` when flag off, `400` on bad params, well-formed clip payload when enabled (injected/mocked Data_Layer + flag)
    - _Requirements: 1.2, 5.2_

- [x] 10. Admin character API route
  - [x] 10.1 Implement `app/api/admin/characters/route.ts`
    - `GET` returns the review queue via `getCharacterReviewQueue`; `POST` validates a zod-parsed `AdminAction` and applies `applyAdminReview`; enforce admin auth with `validateAdminRequest` before any read/mutation (mirror `app/api/admin/data/backfill/route.ts`); `401` unauthenticated, `400` invalid body, `500` on error; optional backfill trigger calls `processStreamerTitles`
    - _Requirements: 6.1, 6.3, 6.4, 6.5, 8.1, 9.1_

  - [ ]* 10.2 Write integration test for admin auth gating
    - Assert `POST`/`GET` return `401` without admin auth before mutating; `400` on invalid action body
    - _Requirements: 6.3, 8.1_

- [x] 11. Character catalog UI (server-renderable)
  - [x] 11.1 Implement `components/streamers/character-catalog.tsx`
    - Render `CharacterCatalogEntry[]` most-recent first (R3.2) with each character's last-seen date (R3.3); show a "no characters identified" message when empty (R3.4); selecting a character drives the clips panel (R3.5)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ]* 11.2 Write unit test for empty catalog message (R3.4)
    - Assert the "no characters identified" message renders when the catalog is empty
    - _Requirements: 3.4_

- [x] 12. Character clips panel UI (client) + VOD seam
  - [x] 12.1 Implement `components/streamers/character-clips-panel.tsx`
    - `'use client'` component mirroring the `viewer-trend-chart.tsx` + `viewer-trend/route.ts` seam: on character selection fetch `/api/streamers/characters?username=&character=`, render clips ordered by views desc (R5.4), show a "no clips" message when empty (R5.5); render the VOD surface only when the API returns a non-empty `vods` payload, otherwise render nothing (R7.3, R7.4); never import service-role code (R8.1)
    - _Requirements: 3.5, 5.2, 5.4, 5.5, 7.2, 7.3, 7.4, 8.1_

  - [ ]* 12.2 Write unit tests for empty-state and no-VOD-source behavior
    - "no clips available" message (R5.5); with an empty `vods` payload the VOD surface is omitted and nothing throws (R7.3, R7.4)
    - _Requirements: 5.5, 7.3, 7.4_

- [x] 13. Admin review queue UI
  - [x] 13.1 Implement `components/admin/character-review-queue.tsx`
    - List `ReviewQueueItem`s and post confirm / override / no-character actions to `app/api/admin/characters`; reflect success/failure in the UI
    - _Requirements: 6.1, 6.3, 6.4, 6.5_

- [x] 14. Wire everything together
  - [x] 14.1 Integrate the catalog + clips panel into the Streamer_Profile
    - In `app/streamers/[platform]/[username]/page.tsx`, gate on `isFeatureFlagEnabled(FEATURE_FLAGS.CHARACTER_TRACKING)` (already `force-dynamic`), call `getCharacterCatalog` server-side, and pass it into `components/streamers/streamer-profile-view.tsx`, which renders `character-catalog.tsx` + `character-clips-panel.tsx` below the existing clip history only when the flag is enabled (R1.2/R1.4 fail-closed; 30s propagation via per-request evaluation R1.3)
    - _Requirements: 1.2, 1.3, 1.4, 3.1, 3.5, 8.1_

  - [x] 14.2 Integrate the review queue into the admin features/data page
    - Mount `components/admin/character-review-queue.tsx` in the appropriate admin page and confirm it reads/writes through `app/api/admin/characters`
    - _Requirements: 6.1, 6.3_

  - [ ]* 14.3 Write property test: fail-closed feature gating
    - `// Feature: streamer-character-tracking, Property 1: For any resolved flag map and loading state, the character-tracking gating decision is true only when the character_tracking flag is explicitly true and not loading; in every other case (disabled, missing, errored, or loading) it is false.`
    - Exercise `isGatedFeatureEnabled(flags, 'character_tracking', loading)`
    - **Property 1: Fail-closed feature gating** — **Validates: Requirements 1.2, 1.4**

  - [ ]* 14.4 Wire VOD end-to-end (optional — pending a VOD data source)
    - When a real VOD source exists, add the VOD read to the Data_Layer + API payload and exercise Property 24 end-to-end; skip while no source is configured (the pure helper + omitted surface already cover R7.4)
    - _Requirements: 7.1, 7.2_

- [x] 15. Final checkpoint - verify the full feature
  - Run `npm run lint`, `npm run check-types`, and the Jest suite (`__tests__/character-extractor.test.ts`, `__tests__/streamer-characters.test.ts`) in single-run mode; fix any failures
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional (test sub-tasks, VOD end-to-end wiring) and can be skipped for a faster MVP; core implementation tasks are never optional.
- Each task references specific requirement sub-clauses for traceability, and every one of Properties 1–24 has a dedicated property-test sub-task carrying the design's tag-comment format and run via the enforced 100-iteration floor in `__tests__/pbt-helpers.ts`.
- Property 24 (VOD overlap) is implemented against the pure overlap helper now (task 3.13) and marked pending end-to-end (task 14.4) because no VOD data source exists yet; R7.4 (omitted surface, no error) is covered by example unit tests.
- Non-testable criteria are handled structurally: R1.3 (propagation timing) via per-request flag evaluation + `force-dynamic`; R8.1 (no direct DB client in pages/routes) by routing all reads through the Data_Layer; R8.2 (RLS/no public SELECT) by the migration in task 1.2.
- Requirements coverage: every requirement (1.1–9.4) is referenced by at least one implementation task, and every property maps to the requirement clause(s) it validates.

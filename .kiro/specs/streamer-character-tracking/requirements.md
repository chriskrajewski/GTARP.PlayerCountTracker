# Requirements Document

## Introduction

This document defines requirements for **Streamer Character Tracking**, an extension of the existing streamer feature on RPStats.com (a real-time GTA RP server tracking and analytics platform built on Next.js App Router, TypeScript, and a PostgreSQL data layer served by Supabase).

In GTA RP, a streamer plays one or more named in-character personas (for example "Jean Paul" or "Yuno Sykk") and typically embeds the active character's name somewhere in the stream title in varied, inconsistent formats. This feature derives the set of characters a streamer plays from their historical stream titles, surfaces that list on the Streamer_Profile, and lets a viewer browse the clips (and, if in scope, VODs) captured while the streamer was playing a given character.

Because clip metadata does not reliably carry the character name, clips are attributed to a character by **time overlap**: a clip is associated with the character the streamer was playing at the time the clip was created, based on the character derived from the stream title active at that moment.

### Approach and Data Sources

- Character names are derived from `stream_title` values in the existing `twitch_streams` table (the single stream table for both Twitch and Kick per `lib/streamers.ts`), which records `streamer_name`, `stream_title`, `viewer_count`, `game_name`, `serverId`, and `created_at`.
- Extraction uses an OpenAI model accessed through the Vercel AI Gateway (via the `ai` package's gateway provider) to extract or infer the character name from a title, with a deterministic fallback path and a confidence signal for human review. This replaces the previously assumed Grok/`@ai-sdk/xai` integration; the Gateway provides a single managed endpoint and API key for the OpenAI model.
- Clips come from the existing `twitch_clips` and `kick_clips` tables.
- All new data reads route through a `lib/` data-access module (mirroring `lib/streamers.ts`) so the in-flight Supabase → Prisma/RDS migration does not require feature rework. New tables follow the established RLS + service-role read pattern.

### Open Questions (to confirm before design)

These are captured as explicit assumptions below and flagged for confirmation. They do not block the initial requirements draft.

1. **VOD data source** — There is no VOD table today. Are VODs a real available data source (e.g., Twitch/Kick VOD API), or is VOD support out of scope for the first version? (Requirement 7 is written as conditional/optional pending this answer.)
2. **Extraction mechanism** — AI-only, heuristic-only, or AI with a heuristic fallback? (Drafted as an OpenAI model via the Vercel AI Gateway, with a deterministic fallback.)
3. **Manual override** — Is an Admin_User correction/override and low-confidence review queue required for v1? (Drafted as required.)
4. **Re-processing cadence** — Should extraction run as the stream ETL ingests new title rows, on a schedule, or as an on-demand backfill? (Drafted to support backfill + incremental.)

## Glossary

- **Platform**: The RPStats.com web application as a whole.
- **Streamer**: A tracked GTA RP streamer identified by a case-insensitive username, present on Twitch and/or Kick.
- **Streamer_Profile**: The existing per-streamer page (`app/streamers/[platform]/[username]`, rendered by `components/streamers/streamer-profile-view.tsx`) backed by `lib/streamers.ts`.
- **Stream_Title_Record**: A single persisted row describing an observed live stream, including `streamer_name`, `stream_title`, `serverId`, and `created_at`, sourced from the `twitch_streams` table.
- **Character**: A named in-character persona a Streamer plays, identified by a normalized character name scoped to a single Streamer.
- **Character_Extractor**: The subsystem that derives a Character name (or "none found") from a Stream_Title_Record using an OpenAI model accessed through the Vercel AI Gateway, with a deterministic fallback, producing a normalized name and a confidence value.
- **AI_Gateway**: The Vercel AI Gateway, a single managed endpoint (accessed via the `ai` package's gateway provider) through which the Character_Extractor calls the configured OpenAI model, using a single Gateway API key.
- **Confidence_Value**: A numeric score in the inclusive range 0.0 to 1.0 that the Character_Extractor assigns to an extraction result, where higher values indicate greater certainty.
- **Confidence_Threshold**: A configurable numeric value in the inclusive range 0.0 to 1.0 at or above which an extraction result is treated as confirmed without human review.
- **Character_Catalog**: The persisted set of distinct Characters derived for a Streamer, each with supporting metadata (first seen, last seen, source title count).
- **Character_Play_Session**: A contiguous time interval, bounded by a start timestamp and an end timestamp, during which a Streamer is determined to have been playing a single Character, derived from consecutive Stream_Title_Records.
- **Clip**: An existing clip record from the `twitch_clips` or `kick_clips` tables, carrying a creation timestamp, streamer username, and platform.
- **VOD**: A recorded past broadcast (video on demand) for a Streamer, carrying a start timestamp and duration. (Availability is an open question; see Requirement 7.)
- **Character_Review_Queue**: The set of extraction results whose Confidence_Value is below the Confidence_Threshold, presented to an Admin_User for confirmation or correction.
- **Admin_User**: An authenticated user with administrative privileges over the Platform.
- **App_User**: An end user of the Platform (authenticated or anonymous) who views public pages.
- **Feature_Flag_System**: The existing flag system (`lib/feature-flags*.ts`, admin features page) used to gate features.
- **Data_Layer**: The shared `lib/` data-access module through which all feature database access is routed.

## Requirements

### Requirement 1: Feature Flag Gating

**User Story:** As an Admin_User, I want character tracking gated behind its own feature flag, so that I can enable or disable it independently without redeploying.

#### Acceptance Criteria

1. THE Feature_Flag_System SHALL define a distinct feature flag that controls the Streamer Character Tracking feature.
2. WHERE the character tracking feature flag is disabled, THE Streamer_Profile SHALL hide all character-tracking UI surfaces from App_Users.
3. WHEN an Admin_User toggles the character tracking feature flag, THE Platform SHALL apply the new flag state to App_User-facing surfaces within 30 seconds without requiring a redeploy.
4. IF the character tracking feature flag value cannot be retrieved, THEN THE Platform SHALL treat the feature as disabled for App_User-facing surfaces.

### Requirement 2: Character Extraction from Stream Titles

**User Story:** As a Platform operator, I want character names extracted from stream titles, so that the set of characters a streamer plays can be built automatically.

#### Acceptance Criteria

1. WHEN the Character_Extractor processes a Stream_Title_Record, THE Character_Extractor SHALL produce either a normalized Character name with a Confidence_Value or an explicit "no character found" result.
2. WHEN the Character_Extractor requests an extraction from the AI model, THE Character_Extractor SHALL call the configured OpenAI model through the AI_Gateway.
3. WHEN the Character_Extractor produces a Character name, THE Character_Extractor SHALL assign a Confidence_Value in the inclusive range 0.0 to 1.0.
4. IF the AI extraction request fails or returns an unusable response, THEN THE Character_Extractor SHALL apply the deterministic fallback extraction and record that the fallback was used.
5. WHEN the Character_Extractor extracts a Character name, THE Character_Extractor SHALL normalize the name by trimming surrounding whitespace and collapsing internal whitespace to single spaces.
6. WHEN two Stream_Title_Records for the same Streamer yield Character names that are equal under case-insensitive comparison after normalization, THE Character_Extractor SHALL treat them as the same Character.
7. THE Character_Extractor SHALL record, for each processed Stream_Title_Record, the source title text, the resulting Character name or "no character found", the Confidence_Value, and the extraction method used.
8. WHEN the Character_Extractor is invoked for a Stream_Title_Record that has already been processed and whose title text is unchanged, THE Character_Extractor SHALL return the previously stored result rather than issuing a new AI extraction request.

### Requirement 3: Character Catalog Display

**User Story:** As a viewer, I want to see the list of characters a streamer plays on their profile, so that I can explore content by character.

#### Acceptance Criteria

1. WHEN an App_User views a Streamer_Profile for a Streamer with at least one confirmed Character, THE Streamer_Profile SHALL display the Streamer's Character_Catalog as a list of distinct Character names.
2. THE Streamer_Profile SHALL display the Character_Catalog ordered by most recently played Character first.
3. WHEN the Streamer_Profile displays a Character, THE Streamer_Profile SHALL display the date that Character was most recently observed.
4. IF a Streamer has no confirmed Characters, THEN THE Streamer_Profile SHALL display a message stating that no characters have been identified for that Streamer.
5. WHEN an App_User selects a Character from the Character_Catalog, THE Streamer_Profile SHALL display the content (Clips, and VODs where in scope) associated with that Character.

### Requirement 4: Character Play Sessions

**User Story:** As a Platform operator, I want time windows for when each character was played, so that clips and VODs can be attributed to the correct character.

#### Acceptance Criteria

1. WHEN the Data_Layer derives Character_Play_Sessions for a Streamer, THE Data_Layer SHALL produce, for each Character, one or more Character_Play_Sessions whose start and end timestamps bound the Stream_Title_Records attributed to that Character.
2. WHEN consecutive Stream_Title_Records for a Streamer in time order resolve to the same Character, THE Data_Layer SHALL group them into a single Character_Play_Session.
3. WHEN consecutive Stream_Title_Records for a Streamer in time order resolve to different Characters, THE Data_Layer SHALL end the current Character_Play_Session and begin a new Character_Play_Session at the boundary timestamp.
4. THE Data_Layer SHALL ensure each Character_Play_Session has a start timestamp less than or equal to its end timestamp.
5. THE Data_Layer SHALL ensure that, for a single Streamer, no two Character_Play_Sessions for different Characters overlap in time.

### Requirement 5: Clip Association to Characters

**User Story:** As a viewer, I want to see clips from streams where a streamer played a specific character, so that I can watch moments featuring that character.

#### Acceptance Criteria

1. WHEN a Clip's creation timestamp falls within a Character_Play_Session for the Clip's Streamer, THE Data_Layer SHALL associate that Clip with the Character of that Character_Play_Session.
2. WHEN an App_User selects a Character, THE Streamer_Profile SHALL display exactly the Clips associated with that Character for that Streamer.
3. IF a Clip's creation timestamp does not fall within any Character_Play_Session for its Streamer, THEN THE Data_Layer SHALL exclude that Clip from every Character's associated Clips.
4. WHEN the Streamer_Profile displays Clips for a selected Character, THE Streamer_Profile SHALL order those Clips by view count in descending order.
5. IF a selected Character has no associated Clips, THEN THE Streamer_Profile SHALL display a message stating that no clips are available for that Character.

### Requirement 6: Admin Review and Correction

**User Story:** As an Admin_User, I want to review low-confidence extractions and correct character names, so that the catalog stays accurate despite messy stream titles.

#### Acceptance Criteria

1. WHEN the Character_Extractor produces a result whose Confidence_Value is below the Confidence_Threshold, THE Platform SHALL add that result to the Character_Review_Queue.
2. WHILE the Character_Extractor produces a result whose Confidence_Value is at or above the Confidence_Threshold, THE Platform SHALL treat that result as a confirmed Character without adding it to the Character_Review_Queue.
3. WHEN an Admin_User confirms a result in the Character_Review_Queue, THE Platform SHALL mark the associated Character as confirmed and remove the result from the Character_Review_Queue.
4. WHEN an Admin_User overrides the Character name for a result, THE Platform SHALL store the corrected Character name as the confirmed name for the associated Stream_Title_Records.
5. WHEN an Admin_User marks a Stream_Title_Record as containing no character, THE Platform SHALL exclude that Stream_Title_Record from every Character_Play_Session.
6. WHEN an Admin_User overrides or confirms a Character name, THE Data_Layer SHALL recompute the affected Character_Play_Sessions and Clip associations to reflect the correction.

### Requirement 7: VOD Association (Conditional — pending open question)

**User Story:** As a viewer, I want to see VODs from streams where a streamer played a specific character, so that I can watch full segments featuring that character.

#### Acceptance Criteria

1. WHERE a VOD data source is available, THE Data_Layer SHALL associate a VOD with each Character whose Character_Play_Session overlaps the VOD's time interval.
2. WHERE a VOD data source is available AND an App_User selects a Character, THE Streamer_Profile SHALL display exactly the VODs associated with that Character for that Streamer.
3. WHERE a VOD data source is available AND a selected Character has no associated VODs, THE Streamer_Profile SHALL display a message stating that no VODs are available for that Character.
4. WHERE no VOD data source is available, THE Streamer_Profile SHALL omit the VOD surface without displaying an error.

### Requirement 8: Data Access, Security, and Migration Safety

**User Story:** As a Platform maintainer, I want character data accessed through the shared data layer with the established security model, so that the feature is consistent and survives the database migration.

#### Acceptance Criteria

1. THE Streamer_Profile and any character-tracking API routes SHALL read character data exclusively through the Data_Layer rather than constructing a database client directly.
2. WHERE a new persisted table stores character data, THE Platform SHALL enable row-level security on that table with no public SELECT policy, and privileged reads SHALL use the service-role client server-side, consistent with the existing streamer and clips tables.
3. WHEN the Data_Layer matches Stream_Title_Records, Clips, or Characters to a Streamer, THE Data_Layer SHALL match the Streamer username case-insensitively and SHALL attribute a record to a Streamer only when the username is exactly equal under case-insensitive comparison.
4. IF a Data_Layer read fails, THEN THE Data_Layer SHALL log the error and return a safe empty value, consistent with the existing `lib/streamers.ts` error handling.

### Requirement 9: Backfill and Incremental Processing

**User Story:** As a Platform operator, I want extraction to run over both historical and newly ingested stream titles, so that the catalog is complete and stays current.

#### Acceptance Criteria

1. WHEN an Admin_User triggers a character extraction backfill for a Streamer, THE Platform SHALL process every Stream_Title_Record for that Streamer that has not yet been processed.
2. WHEN new Stream_Title_Records are ingested for a Streamer, THE Platform SHALL process the newly ingested Stream_Title_Records through the Character_Extractor.
3. WHILE a backfill is processing previously processed Stream_Title_Records whose title text is unchanged, THE Platform SHALL reuse stored extraction results rather than issuing new AI extraction requests (idempotent reprocessing).
4. WHEN the same set of Stream_Title_Records is processed more than once with unchanged titles and unchanged Admin_User corrections, THE Character_Catalog and Character_Play_Sessions SHALL be identical to the result of processing them once.

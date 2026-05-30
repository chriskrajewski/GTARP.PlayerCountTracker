/**
 * Custom `fast-check` arbitraries shared across property-based tests.
 *
 * Feature-specific arbitraries (player-count series, pinned-server selections,
 * alert subscriptions, multi-user stores, etc.) will be added here as the
 * corresponding feature tasks are implemented, so generators are written once
 * and reused across suites.
 *
 * This module is intentionally excluded from Jest's test matching (see
 * jest.config.mjs) because it exports helpers, not test suites.
 */
import fc from 'fast-check'

import type { ResolvedTitleRecord } from '@/lib/streamer-characters'
import type { Clip, StreamerPlatform } from '@/lib/streamers'

/**
 * A non-empty, trimmed identifier string suitable for server ids, usernames,
 * and similar keys. Kept generic for now; specialize per feature as needed.
 */
export const idArbitrary: fc.Arbitrary<string> = fc
  .string({ minLength: 1, maxLength: 24 })
  .map((s) => s.trim())
  .filter((s) => s.length > 0)
/* ------------------------------------------------------------------------- *
 * Name-generation arbitraries (Streamer Character Tracking)
 *
 * These drive the name-normalization / identity properties (5, 6) and the
 * extraction properties (2–6) described in the design's "Testing Strategy >
 * Generators" section.
 * ------------------------------------------------------------------------- */

/** A single whitespace character: space, tab, and the common line/page breaks. */
const whitespaceCharArbitrary: fc.Arbitrary<string> = fc.constantFrom(
  ' ',
  '\t',
  '\n',
  '\r',
  '\f',
  '\v',
)

/** A run of 1–4 whitespace characters (mixed kinds), e.g. `"  \t\n"`. */
const whitespaceRunArbitrary: fc.Arbitrary<string> = fc
  .array(whitespaceCharArbitrary, { minLength: 1, maxLength: 4 })
  .map((chars) => chars.join(''))

/** A short token of mixed-case ASCII letters, e.g. `"jEaN"`. */
const mixedCaseWordArbitrary: fc.Arbitrary<string> = fc
  .array(
    fc.constantFrom(
      ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''),
    ),
    { minLength: 1, maxLength: 8 },
  )
  .map((chars) => chars.join(''))

/**
 * Strings that stress whitespace handling and case-insensitivity: leading and
 * trailing whitespace runs, multi-character internal whitespace runs between
 * mixed-case word tokens, plus the degenerate whitespace-only case (which
 * normalizes to the empty string). Used to exercise `normalizeCharacterName`
 * (idempotency, trimming, internal-run collapsing) and `charactersEqual`
 * (Properties 5, 6).
 */
export const whitespaceVariantArbitrary: fc.Arbitrary<string> = fc.oneof(
  // Whitespace-only strings — normalize to ''.
  whitespaceRunArbitrary,
  // Mixed-case words wrapped in, and separated by, whitespace runs.
  fc
    .record({
      leading: fc.option(whitespaceRunArbitrary, { nil: '' }),
      words: fc.array(mixedCaseWordArbitrary, { minLength: 1, maxLength: 4 }),
      separators: fc.array(whitespaceRunArbitrary, { minLength: 0, maxLength: 8 }),
      trailing: fc.option(whitespaceRunArbitrary, { nil: '' }),
    })
    .map(({ leading, words, separators, trailing }) => {
      const parts: string[] = [leading]
      words.forEach((word, i) => {
        if (i > 0) parts.push(separators[i - 1] ?? ' ')
        parts.push(word)
      })
      parts.push(trailing)
      return parts.join('')
    }),
)

/** Common delimiters seen between segments of GTA RP stream titles. */
const titleDelimiterArbitrary: fc.Arbitrary<string> = fc.constantFrom(
  '|',
  '-',
  '–',
  '•',
  '/',
  ':',
)

/** A realistic character name, including names with unicode/accented letters. */
const characterNameArbitrary: fc.Arbitrary<string> = fc.oneof(
  fc.constantFrom(
    'Jean Paul',
    'Yuno Sykk',
    'Mickey S',
    'Ramee El-Rahman',
    'Lang Buddha',
    'Tony Corleone',
    'Dystros Vicatci',
    'Café Olé',
    'Søren Vølund',
    'José Ramírez',
    'Renée Dubois',
  ),
  fc
    .tuple(
      fc.constantFrom('Jean', 'Yuno', 'Mickey', 'Ramee', 'Tony', 'José', 'Søren'),
      fc.constantFrom('Paul', 'Sykk', 'Corleone', 'Vølund', 'Ramírez', 'Smith'),
    )
    .map(([first, last]) => `${first} ${last}`),
)

/**
 * Noise segments that surround the character name in real titles: server
 * names, GTA/RP/NoPixel tags, chat `!commands`, emoji, and unicode noise.
 */
const titleNoiseArbitrary: fc.Arbitrary<string> = fc.oneof(
  fc.constantFrom('NoPixel', 'NoPixel 4.0', 'Prodigy', 'OnX', 'Unscripted', 'New Day RP'),
  fc.constantFrom('GTA RP', 'GTARP', 'RP', '#GTARP', 'NoPixel WL', 'GTA V'),
  fc.constantFrom('!socials', '!discord', '!merch', '!youtube', '!prime'),
  fc.constantFrom('🔴', '🎮', '😂', '✨', '💀', '🚓', '🎬', '🔥'),
  fc.constantFrom('día uno', 'naïve', 'Москва', '日本語配信', 'ñoño', '—'),
)

/**
 * Realistic GTA RP stream titles: a character name embedded among noise
 * segments (server names, GTA/RP tags, `!commands`, emoji, unicode), joined by
 * the common title delimiters (`| - – • / :`), with or without surrounding
 * spaces. Drives the extraction properties (Properties 2–6).
 */
export const titleArbitrary: fc.Arbitrary<string> = fc
  .record({
    pre: fc.array(titleNoiseArbitrary, { maxLength: 3 }),
    character: characterNameArbitrary,
    post: fc.array(titleNoiseArbitrary, { maxLength: 3 }),
    delimiters: fc.array(titleDelimiterArbitrary, { minLength: 1, maxLength: 8 }),
    padDelimiter: fc.boolean(),
  })
  .map(({ pre, character, post, delimiters, padDelimiter }) => {
    const segments = [...pre, character, ...post]
    const separatorAt = (gap: number): string => {
      const delimiter = delimiters[gap % delimiters.length]
      return padDelimiter ? ` ${delimiter} ` : delimiter
    }
    const parts: string[] = []
    segments.forEach((segment, i) => {
      if (i > 0) parts.push(separatorAt(i - 1))
      parts.push(segment)
    })
    return parts.join('')
  })

/* ------------------------------------------------------------------------- *
 * Derivation arbitraries (Streamer Character Tracking)
 *
 * These drive the pure derivation properties — sessions/catalog (8–13, 23),
 * clip association/ordering (14, 15), and VOD overlap (24) — described in the
 * design's "Testing Strategy > Generators" section. They produce inputs to the
 * pure core in `lib/streamer-characters.ts`
 * (`deriveCharacterPlaySessions`, `buildCharacterCatalog`,
 * `associateClipToCharacter`, `vodCharactersByOverlap`).
 * ------------------------------------------------------------------------- */

/**
 * Local mirror of `lib/streamer-characters.ts`'s default `SESSION_TAIL_MS`
 * (10 minutes). Gap deltas are generated relative to this so some gaps fall
 * BELOW the cap (consecutive same-character records merge into one session) and
 * some ABOVE it (sessions split), exercising both branches of the derivation.
 */
const SESSION_TAIL_MS = 10 * 60 * 1000

/**
 * A small pool of character names (plus `null` separators) so collisions are
 * frequent — multiple records resolve to the SAME character and must collapse
 * into a single catalog entry / merge into sessions. `null` records are
 * interspersed (they act as separators that break a run, R4.3).
 */
const resolvedCharacterArbitrary: fc.Arbitrary<string | null> = fc.oneof(
  { weight: 4, arbitrary: fc.constantFrom('Jean Paul', 'Yuno Sykk', 'Mickey S', 'Tony Corleone') },
  { weight: 1, arbitrary: fc.constant(null) },
)

/**
 * A non-negative gap (ms) to the next record. Mixes three regimes so the
 * derived sessions both merge and split, and duplicate timestamps occur:
 *  - `0` — a DUPLICATE timestamp (tests the `(timestamp, id)` total order),
 *  - `1 .. SESSION_TAIL_MS - 1` — BELOW the cap (same-character run continues),
 *  - `SESSION_TAIL_MS + 1 .. 6×cap` — ABOVE the cap (the run is broken / split).
 */
const recordGapMsArbitrary: fc.Arbitrary<number> = fc.oneof(
  { weight: 1, arbitrary: fc.constant(0) },
  { weight: 3, arbitrary: fc.integer({ min: 1, max: SESSION_TAIL_MS - 1 }) },
  { weight: 2, arbitrary: fc.integer({ min: SESSION_TAIL_MS + 1, max: SESSION_TAIL_MS * 6 }) },
)

/** A single step: the character for this record and the gap to the next one. */
const recordStepArbitrary: fc.Arbitrary<{ character: string | null; gapMs: number }> = fc.record({
  character: resolvedCharacterArbitrary,
  gapMs: recordGapMsArbitrary,
})

/**
 * A realistic base epoch (ms) for the first record: somewhere in 2023–2024 so
 * derived timestamps land in a plausible range.
 */
const sessionBaseEpochMsArbitrary: fc.Arbitrary<number> = fc.integer({
  min: Date.UTC(2023, 0, 1),
  max: Date.UTC(2024, 11, 31),
})

/**
 * Time-ordered {@link ResolvedTitleRecord} arrays for the session/catalog
 * derivation properties (8–13, 23). Built by cumulatively summing a base epoch
 * with non-negative gap deltas, so the records include: a small character pool
 * (collisions), interspersed `null` separators, DUPLICATE timestamps (zero
 * gaps), and gap variety both below and above {@link SESSION_TAIL_MS} (sessions
 * merge and split). IDs are unique and sequential. The array is sometimes
 * shuffled (the function under test sorts by `(timestamp, id)`), so both sorted
 * and unsorted inputs are exercised.
 */
export const resolvedRecordsArbitrary: fc.Arbitrary<ResolvedTitleRecord[]> = fc
  .record({
    baseEpochMs: sessionBaseEpochMsArbitrary,
    steps: fc.array(recordStepArbitrary, { minLength: 0, maxLength: 30 }),
    shuffle: fc.boolean(),
    shuffleKeys: fc.array(fc.integer({ min: 0, max: 1_000_000 }), { maxLength: 30 }),
  })
  .map(({ baseEpochMs, steps, shuffle, shuffleKeys }): ResolvedTitleRecord[] => {
    // Cumulative-sum the gaps into ascending timestamps; a zero gap repeats the
    // previous timestamp (duplicate). Pair with unique sequential ids.
    let cursor = baseEpochMs
    const records: ResolvedTitleRecord[] = steps.map((step, i) => {
      cursor += step.gapMs
      return {
        id: i + 1,
        timestamp: new Date(cursor).toISOString(),
        character: step.character,
      }
    })

    if (!shuffle) return records

    // Perturb array order WITHOUT changing ids/timestamps, so the derivation's
    // own `(timestamp, id)` sort is exercised on unsorted input. Falls back to
    // the original index when a key is absent (a stable, partial shuffle).
    return records
      .map((record, i) => ({ record, key: shuffleKeys[i] ?? i }))
      .sort((a, b) => a.key - b.key)
      .map(({ record }) => record)
  })

/**
 * A realistic epoch (ms) for clip/VOD timestamps. The range is slightly WIDER
 * than {@link sessionBaseEpochMsArbitrary} (late 2022 → early 2025) so a clip or
 * VOD can land inside a session window, in a gap between sessions, or entirely
 * outside the streamer's session span — the three cases the association logic
 * must distinguish (R5.1–5.3, R7.1).
 */
const clipEpochMsArbitrary: fc.Arbitrary<number> = fc.integer({
  min: Date.UTC(2022, 11, 1),
  max: Date.UTC(2025, 0, 31),
})

/** Twitch/Kick platform literal. */
const platformArbitrary: fc.Arbitrary<StreamerPlatform> = fc.constantFrom('twitch', 'kick')

/**
 * {@link Clip} objects for the clip-association / ordering properties (14, 15).
 * `createdAt` is drawn from {@link clipEpochMsArbitrary} so clips fall inside,
 * between, and outside session windows. `viewCount` uses a deliberately SMALL
 * integer range so TIES occur frequently, stressing the stability of the
 * "order by view count descending" guarantee (R5.4).
 */
export const clipArbitrary: fc.Arbitrary<Clip> = fc
  .record({
    clipId: fc.uuid(),
    streamerUsername: idArbitrary,
    title: titleArbitrary,
    viewCount: fc.integer({ min: 0, max: 20 }),
    durationSeconds: fc.integer({ min: 1, max: 600 }),
    thumbnailUrl: fc.webUrl(),
    url: fc.webUrl(),
    createdAt: clipEpochMsArbitrary.map((ms) => new Date(ms).toISOString()),
    platform: platformArbitrary,
    channelSlug: fc.option(idArbitrary, { nil: undefined }),
  })
  .map((clip): Clip => clip)

/**
 * VOD intervals `{ start, end }` (ISO) for the VOD-overlap property (24), with
 * `start <= end` always (a zero-length VOD is allowed). Drawn from the same
 * realistic epoch range as clips/sessions so some intervals OVERLAP one or more
 * session windows and some are DISJOINT from every session.
 */
export const vodIntervalArbitrary: fc.Arbitrary<{ start: string; end: string }> = fc
  .record({
    startMs: clipEpochMsArbitrary,
    durationMs: fc.integer({ min: 0, max: SESSION_TAIL_MS * 12 }),
  })
  .map(({ startMs, durationMs }): { start: string; end: string } => ({
    start: new Date(startMs).toISOString(),
    end: new Date(startMs + durationMs).toISOString(),
  }))

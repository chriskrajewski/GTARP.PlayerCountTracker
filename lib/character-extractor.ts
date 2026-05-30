/**
 * Character_Extractor — derives a single in-character persona name from a GTA RP
 * stream title (Streamer Character Tracking).
 *
 * This module owns the extraction result shape, the zod schema used to validate
 * the AI Gateway's structured response, and the pure name-handling primitives
 * (`normalizeCharacterName`, `charactersEqual`) that define character identity.
 *
 * The AI Gateway call path and the deterministic heuristic fallback
 * (`heuristicExtract`, `extractCharacterFromTitle`) are added in later tasks;
 * this file currently provides the foundational types/schema plus the two pure
 * functions that the derivation core and the extractor both build on.
 */

import { z } from 'zod';

/** How an extraction result was produced (recorded for audit — R2.7). */
export type ExtractionMethod = 'ai' | 'fallback';

/** Output of a single extraction (R2.1, R2.3). */
export interface CharacterExtractionResult {
  /** Normalized character name, or null for an explicit "no character found". */
  characterName: string | null;
  /** Confidence in the inclusive range 0.0–1.0 (R2.3). */
  confidence: number;
  /** Which path produced the result (R2.4, R2.7). */
  method: ExtractionMethod;
  /** The source title text the result was derived from (R2.7). */
  sourceTitle: string;
}

/** Zod schema used to validate the AI Gateway's structured response. */
export const AiExtractionSchema = z.object({
  characterName: z.string().nullable(),
  confidence: z.number().min(0).max(1),
});

/**
 * Normalize a raw character name (R2.5): trim surrounding whitespace and
 * collapse internal whitespace runs to single spaces. Case is PRESERVED for
 * display; identity comparison is case-insensitive (see `charactersEqual`).
 * Returns '' for names that are empty after normalization.
 *
 * Normalization is idempotent: `normalizeCharacterName(normalizeCharacterName(x))
 * === normalizeCharacterName(x)`.
 */
export function normalizeCharacterName(raw: string): string {
  // Collapse every internal run of whitespace (spaces, tabs, newlines, etc.) to
  // a single ASCII space, then trim the surrounding whitespace. Order does not
  // matter for correctness — trimming after the collapse leaves at most a single
  // leading/trailing space to remove — and the result is idempotent because a
  // normalized string has no whitespace runs and no surrounding whitespace.
  return raw.replace(/\s+/g, ' ').trim();
}

/** Case-insensitive identity over normalized names (R2.6). */
export function charactersEqual(a: string, b: string): boolean {
  return normalizeCharacterName(a).toLowerCase() === normalizeCharacterName(b).toLowerCase();
}

/**
 * Fixed, modest confidence assigned to a heuristic-fallback extraction that
 * produced a plausible name (R2.4). Kept deliberately below the default
 * `Confidence_Threshold` (0.7) so every fallback result is routed to the
 * Admin_Review_Queue rather than auto-confirmed (R6.1).
 */
export const FALLBACK_CONFIDENCE = 0.4;

/**
 * Confidence recorded when the heuristic finds no plausible character at all.
 * A null result carries no information, so it gets the lowest possible
 * confidence; it is still recorded with `method: 'fallback'` (R2.4, R2.7).
 */
const FALLBACK_NULL_CONFIDENCE = 0.0;

/**
 * Injectable AI caller so tests never hit the network (per design
 * "Character_Extractor"). The concrete gateway-backed implementation is wired
 * up in `extractCharacterFromTitle` (task 5.2); callers may inject a fake.
 */
export interface CharacterAiClient {
  extract(title: string): Promise<{ characterName: string | null; confidence: number }>;
}

/**
 * Build the prompt sent to the OpenAI model through the AI Gateway. The prompt
 * instructs the model to extract the GTA RP in-character persona name from a
 * stream title and to return a JSON object with `characterName` (string or
 * null) and `confidence` (0..1). It is concise and deterministic: the same
 * title always yields the same prompt (no timestamps, randomness, or env
 * lookups), which keeps the gateway path reproducible in tests.
 */
export function buildExtractionPrompt(title: string): string {
  return [
    'You extract the in-character persona name a GTA RP streamer is playing from a stream title.',
    'GTA RP streamers embed a character name (e.g. "Jean Paul", "Yuno Sykk") among server tags, emojis, and !commands.',
    'Return ONLY a JSON object with exactly these two fields:',
    '- "characterName": the character name as a string, or null when the title contains no identifiable character.',
    '- "confidence": a number from 0.0 to 1.0 indicating how certain you are.',
    'Ignore server names (NoPixel, Prodigy, etc.), generic tags such as "GTA" or "RP", chat commands (text starting with !), and emoji.',
    `Stream title: ${JSON.stringify(title)}`,
  ].join('\n');
}

/** Delimiters GTA RP streamers commonly use to separate title segments. */
const SEGMENT_DELIMITERS = /[|\-–•/:]/u;

/**
 * Lower-cased tokens that are noise rather than character names: server names,
 * platform/genre tags, and other boilerplate. A segment composed entirely of
 * these tokens (and/or non-letter tokens) is discarded.
 */
const NOISE_WORDS = new Set<string>([
  'nopixel',
  'np',
  'prodigy',
  'gtarp',
  'gta',
  'rp',
  'roleplay',
  'grand',
  'theft',
  'auto',
  'fivem',
  'server',
  'twitch',
  'kick',
  'live',
  'stream',
  'vod',
  'vods',
  'clip',
  'clips',
]);

/**
 * Decide whether a normalized, lower-cased segment is noise and should be
 * discarded: empty segments, `!commands`, and segments whose every word is a
 * known noise token or contains no letters (emoji-only / symbol-only / numeric
 * tags such as "4.0").
 */
function isNoiseSegment(normalizedLower: string): boolean {
  if (normalizedLower === '') return true;
  if (normalizedLower.startsWith('!')) return true; // !commands
  const words = normalizedLower.split(' ');
  return words.every((word) => NOISE_WORDS.has(word) || !/\p{L}/u.test(word));
}

/**
 * Deterministic plausibility score for a normalized candidate segment. Higher
 * is more name-like. Returns a negative score to disqualify segments that do
 * not look like a character name. The "most plausible segment" is the one with
 * the highest score; ties are broken by earliest position (see
 * `heuristicExtract`), keeping the function pure and deterministic.
 *
 * A name-like segment is: 1–4 words, a reasonable length (2–40 non-space
 * characters), and mostly letters (letter ratio >= 0.6, which rejects
 * symbol/emoji/number-heavy fragments). Slightly favors 1–3 word names.
 */
function scoreSegment(normalized: string): number {
  if (normalized === '') return -1;

  const words = normalized.split(' ');
  if (words.length < 1 || words.length > 4) return -1;

  const nonSpace = normalized.replace(/\s/g, '');
  if (nonSpace.length < 2 || nonSpace.length > 40) return -1;

  const letterCount = (nonSpace.match(/\p{L}/gu) ?? []).length;
  const letterRatio = letterCount / nonSpace.length;
  if (letterRatio < 0.6) return -1;

  let score = letterRatio;
  if (words.length <= 3) score += 0.1;
  return score;
}

/**
 * Deterministic, network-free heuristic fallback (R2.4, R2.5). Splits the title
 * on common GTA RP delimiters (`| - – • / :`), discards segments matching known
 * noise (server names, `GTA`/`RP`/`NoPixel` tags, `!commands`, emoji-only or
 * symbol-only, and empty segments), and returns the most plausible remaining
 * segment as a NORMALIZED name with a fixed modest confidence
 * ({@link FALLBACK_CONFIDENCE} = 0.4, below the 0.7 threshold so it is
 * reviewed). When nothing plausible remains it returns a null result with the
 * lowest confidence. Always records `method: 'fallback'` and the original
 * `sourceTitle`.
 *
 * "Most plausible segment" is chosen by {@link scoreSegment}: prefer a segment
 * that looks like a name (1–4 words, mostly letters, reasonable length), with
 * ties broken deterministically by earliest position in the title. The function
 * is pure: no network, no `Date.now()`, no randomness.
 */
export function heuristicExtract(title: string): CharacterExtractionResult {
  const segments = title.split(SEGMENT_DELIMITERS);

  let bestName: string | null = null;
  let bestScore = -1;

  for (const segment of segments) {
    const normalized = normalizeCharacterName(segment);
    if (isNoiseSegment(normalized.toLowerCase())) continue;

    const score = scoreSegment(normalized);
    // Strict `>` keeps the earliest segment on a tie (deterministic).
    if (score > bestScore) {
      bestScore = score;
      bestName = normalized;
    }
  }

  if (bestName === null) {
    return {
      characterName: null,
      confidence: FALLBACK_NULL_CONFIDENCE,
      method: 'fallback',
      sourceTitle: title,
    };
  }

  return {
    characterName: bestName,
    confidence: FALLBACK_CONFIDENCE,
    method: 'fallback',
    sourceTitle: title,
  };
}

/** Clamp a confidence value into the inclusive range [0, 1] (R2.3). */
function clampConfidence(c: number): number {
  return Math.min(1, Math.max(0, c));
}

/**
 * Build the DEFAULT, gateway-backed {@link CharacterAiClient}.
 *
 * IMPORTANT — `ai` v4 vs v5 gateway export:
 * The design sketches `import { gateway, generateObject } from 'ai'`, but the
 * installed `ai` version (v4.3.x) does NOT export `gateway` — that provider was
 * introduced in `ai` v5. To keep this file compiling cleanly against the
 * installed dependencies (and to avoid adding new ones), the default client
 * reaches the Vercel AI Gateway through its OpenAI-compatible HTTP endpoint
 * using the already-installed `@ai-sdk/xai` provider (`createXai`), which is an
 * OpenAI-compatible chat provider that accepts a custom `baseURL` + `apiKey`.
 * `generateObject` (which IS exported by `ai` v4) validates the structured
 * response against {@link AiExtractionSchema}.
 *
 * Wiring is done via dynamic `import()` so that:
 *   1. the module compiles and type-checks without statically pulling the
 *      ESM-only `ai` / `@ai-sdk/xai` packages into non-gateway consumers, and
 *   2. ANY failure here (missing key, network/provider error, ESM/runtime
 *      issue, schema violation) propagates as a thrown error that
 *      {@link extractCharacterFromTitle} catches and routes to
 *      {@link heuristicExtract} (Property 4).
 *
 * TO COMPLETE / CHANGE THE REAL WIRING:
 * - Set `AI_GATEWAY_API_KEY` (the single Vercel AI Gateway key) and optionally
 *   `AI_GATEWAY_MODEL` (default `openai/gpt-4o-mini`) and `AI_GATEWAY_BASE_URL`
 *   (default the Vercel AI Gateway OpenAI-compatible endpoint).
 * - If/when the project upgrades to `ai` v5, this can be simplified to the
 *   design's `model: gateway(MODEL_ID)` form; replace the `createXai(...)`
 *   provider construction below with `gateway(MODEL_ID)` and keep the rest.
 */
function buildDefaultAiClient(): CharacterAiClient {
  return {
    async extract(title: string): Promise<{ characterName: string | null; confidence: number }> {
      const apiKey = process.env.AI_GATEWAY_API_KEY;
      if (!apiKey) {
        // No key configured → throw so the caller falls back to the heuristic.
        throw new Error('AI_GATEWAY_API_KEY is not set');
      }

      const modelId = process.env.AI_GATEWAY_MODEL ?? 'openai/gpt-4o-mini';
      // Vercel AI Gateway OpenAI-compatible base URL (overridable for testing).
      const baseURL = process.env.AI_GATEWAY_BASE_URL ?? 'https://ai-gateway.vercel.sh/v1';

      // Dynamic imports keep these ESM-only packages out of the module's static
      // graph; resolved lazily only when the real gateway path actually runs.
      const { generateObject } = await import('ai');
      const { createXai } = await import('@ai-sdk/xai');

      const provider = createXai({ apiKey, baseURL });

      const { object } = await generateObject({
        model: provider(modelId),
        schema: AiExtractionSchema,
        prompt: buildExtractionPrompt(title),
      });

      // `object` is validated by AiExtractionSchema: { characterName, confidence }.
      return object;
    },
  };
}

/**
 * Extract a character from a stream title (R2.1, R2.2, R2.3, R2.4, R2.7).
 *
 * Behavior:
 * - When an `aiClient` is injected it is used directly; otherwise a default,
 *   gateway-backed client ({@link buildDefaultAiClient}) is constructed that
 *   calls the configured OpenAI model through the AI Gateway.
 * - The AI client's raw output is validated with {@link AiExtractionSchema}.
 *   On a thrown error, a schema-validation failure (including NaN / missing /
 *   out-of-range confidence or a non-string/non-null name), the extractor FALLS
 *   BACK to {@link heuristicExtract}, which always records `method: 'fallback'`
 *   (Property 4).
 * - On AI success: `method: 'ai'`, `characterName` is the NORMALIZED name (an
 *   empty normalized name is treated as `null`), `confidence` is CLAMPED into
 *   the inclusive range [0, 1] (Property 3), and `sourceTitle` is the original
 *   `title`.
 *
 * The result is always a well-formed {@link CharacterExtractionResult} with a
 * normalized `characterName` (Property 2). The function never throws.
 */
export async function extractCharacterFromTitle(
  title: string,
  aiClient?: CharacterAiClient,
): Promise<CharacterExtractionResult> {
  const client = aiClient ?? buildDefaultAiClient();

  try {
    const raw = await client.extract(title);

    // Validate the AI output. Schema enforces a string|null name and a numeric
    // confidence in [0,1]; NaN/missing/out-of-range/wrong-type all fail here and
    // route to the deterministic heuristic fallback (R2.4, Property 4).
    const parsed = AiExtractionSchema.safeParse(raw);
    if (!parsed.success) {
      return heuristicExtract(title);
    }

    const { characterName, confidence } = parsed.data;

    // Normalize the name; an empty normalized name carries no character, so it
    // becomes null (R2.5; "empty normalized name from the AI path → null").
    const normalized = characterName === null ? null : normalizeCharacterName(characterName);
    const finalName = normalized === null || normalized === '' ? null : normalized;

    return {
      characterName: finalName,
      // Defensive clamp — the schema already constrains [0,1], but clamping
      // guarantees Property 3 regardless of how the client is implemented.
      confidence: clampConfidence(confidence),
      method: 'ai',
      sourceTitle: title,
    };
  } catch {
    // Thrown error (network, provider unavailable, ESM/runtime issue, etc.) →
    // deterministic heuristic fallback with method: 'fallback' (Property 4).
    return heuristicExtract(title);
  }
}

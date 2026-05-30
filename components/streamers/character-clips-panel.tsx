'use client';

/**
 * Character_Clips_Panel — the interactive (client) half of the Streamer_Profile
 * character surface (task 12.1).
 *
 * This component OWNS the catalog selection state. It renders the (controlled)
 * `CharacterCatalog` and, when the viewer selects a character, fetches that
 * character's clips from the public `/api/streamers/characters` route.
 *
 * Why a client + API seam (R8.1): the catalog itself is derived server-side and
 * handed in as `entries`, but selecting a character must trigger a fresh read of
 * the selected character's clips. Rather than import the service-role
 * `lib/streamer-characters.ts` reads into client code, this component fetches
 * the data over the public route — exactly mirroring the
 * `viewer-trend-chart.tsx` + `viewer-trend/route.ts` seam. ONLY TYPES are
 * imported from the Data_Layer (`import type`), never the read functions.
 *
 * Clip ordering (R5.4): the API already returns clips ordered by view count
 * descending, so this component renders them in the order received.
 *
 * VOD surface (R7.2/R7.3/R7.4): the VOD list is rendered ONLY when the API
 * returns a NON-EMPTY `vods` array. When `vods` is empty or absent, nothing is
 * rendered for VODs — no error, no empty section (R7.4). The API currently
 * always returns `vods: []`, so the surface is effectively omitted today; the
 * code is structured so a future non-empty payload would render a VOD list.
 */

import { useCallback, useState } from 'react';
import {
  Loader2,
  Film,
  Eye,
  ExternalLink,
  Clock,
  MousePointerClick,
  Twitch,
  Video,
} from 'lucide-react';
import { CharacterCatalog } from '@/components/streamers/character-catalog';
import type {
  CharacterCatalogEntry,
  Clip,
  StreamerPlatform,
} from '@/lib/streamer-characters';

/**
 * Minimal, intentionally loose VOD shape (R7). No VOD data source exists yet,
 * so the API always returns `vods: []`; this keeps the type permissive while
 * still letting the render path key off the presence of fields a future payload
 * would carry. Tighten this when a real VOD source is wired in (task 14.4).
 */
interface Vod {
  id?: string;
  title?: string;
  url?: string;
  thumbnailUrl?: string;
  createdAt?: string;
}

interface CharacterClipsPanelProps {
  /** Streamer username the catalog + clips are scoped to. */
  username: string;
  /** Platform scope for the profile this panel lives on. */
  platform: StreamerPlatform;
  /**
   * Server-fetched Character_Catalog, already ordered most-recent first by the
   * Data_Layer's `buildCharacterCatalog` (R3.2). This component owns the
   * selection state and drives the clips fetch from it.
   */
  entries: CharacterCatalogEntry[];
}

/** Shape of the `/api/streamers/characters` success/error payload. */
interface CharacterClipsResponse {
  success: boolean;
  clips?: Clip[];
  vods?: Vod[];
  error?: string;
}

/** Brand-accurate Kick glyph (lucide has no Kick icon), mirroring the profile view. */
function KickIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M1.333 0v24h21.334V0H1.333zm17.12 18.347h-4.32l-3.093-4.907-1.653 1.76v3.147H5.654V5.653h3.733v5.28l4.48-5.28h4.427l-4.907 5.44 4.986 7.254h.08z" />
    </svg>
  );
}

/** Platform badge with the platform's brand color + icon (mirrors the profile view). */
function PlatformBadge({ platform }: { platform: StreamerPlatform }) {
  if (platform === 'kick') {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium"
        style={{ background: 'rgba(83, 252, 24, 0.15)', color: '#53fc18' }}
      >
        <KickIcon className="h-3.5 w-3.5" />
        Kick
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium"
      style={{ background: 'rgba(145, 70, 255, 0.15)', color: '#a855f7' }}
    >
      <Twitch className="h-3.5 w-3.5" />
      Twitch
    </span>
  );
}

/** Format a clip duration in seconds to a compact label (mirrors the profile view). */
function formatDuration(seconds: number): string {
  if (!seconds || seconds < 0) return 'N/A';
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

/**
 * Single clip card (thumbnail, title, view count, platform badge, external
 * link) — a local mirror of the `ClipCard` styling in
 * `components/streamers/streamer-profile-view.tsx` so the character clips read
 * visually consistent with the streamer's main clip history.
 */
function ClipCard({ clip }: { clip: Clip }) {
  return (
    <a
      href={clip.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group/clip block overflow-hidden rounded-lg border border-[#26262c] bg-[#18181b]/60 transition-all hover:border-cyan-500/40"
    >
      <div className="relative aspect-video overflow-hidden bg-gray-900">
        {clip.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={clip.thumbnailUrl}
            alt={clip.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover/clip:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-purple-900/30 to-gray-900">
            <Film className="h-8 w-8 text-purple-400/50" />
          </div>
        )}
        <div className="absolute bottom-2 right-2 rounded bg-black/80 px-2 py-1 text-xs text-white backdrop-blur-sm">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDuration(clip.durationSeconds)}
          </span>
        </div>
        <div className="absolute left-2 top-2">
          <PlatformBadge platform={clip.platform} />
        </div>
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-300 group-hover/clip:opacity-100">
          <ExternalLink className="h-6 w-6 text-white" />
        </div>
      </div>
      <div className="space-y-2 p-3">
        <h3 className="line-clamp-2 text-sm font-medium leading-snug text-white">{clip.title}</h3>
        <div className="flex items-center gap-1 text-xs text-gray-400">
          <Eye className="h-3.5 w-3.5 text-cyan-400/70" />
          {clip.viewCount.toLocaleString()} views
        </div>
      </div>
    </a>
  );
}

/**
 * VOD surface (R7.2/R7.3). Rendered ONLY when `vods` is non-empty — the caller
 * guards on length, so this component assumes at least one VOD. Kept minimal
 * and tolerant of the loose `Vod` shape until a real source exists (task 14.4).
 */
function VodList({ vods }: { vods: Vod[] }) {
  return (
    <div className="mt-6">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
        <Video className="h-4 w-4 text-cyan-400" aria-hidden="true" />
        VODs
      </h3>
      <ul className="flex flex-col gap-2">
        {vods.map((vod, index) => (
          <li key={vod.id ?? vod.url ?? index}>
            <a
              href={vod.url ?? '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-3 rounded-lg border border-[#26262c] bg-[#18181b]/60 px-4 py-3 text-sm text-gray-200 transition-all hover:border-cyan-500/40 hover:text-cyan-200"
            >
              <span className="truncate">{vod.title ?? 'Untitled VOD'}</span>
              <ExternalLink className="h-4 w-4 shrink-0 text-cyan-400/70" aria-hidden="true" />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Owns the Character_Catalog selection state and renders the selected
 * character's clips (and VODs, when present). Mirrors the
 * `viewer-trend-chart.tsx` fetch/error/loading handling.
 */
export function CharacterClipsPanel({ username, platform, entries }: CharacterClipsPanelProps) {
  const [selectedCharacter, setSelectedCharacter] = useState<string | null>(null);
  const [clips, setClips] = useState<Clip[]>([]);
  const [vods, setVods] = useState<Vod[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch the selected character's clips, mirroring viewer-trend-chart's seam:
  // URL built against window.location.origin, response.ok check, body.success
  // check, try/catch/finally with the loading flag (R5.2, R5.4, R8.1).
  const handleSelect = useCallback(
    async (characterName: string) => {
      setSelectedCharacter(characterName);
      setLoading(true);
      setError(null);
      try {
        const url = new URL('/api/streamers/characters', window.location.origin);
        url.searchParams.set('username', username);
        url.searchParams.set('character', characterName);

        const response = await fetch(url.toString());
        if (!response.ok) {
          throw new Error(`Request failed (${response.status})`);
        }
        const body: CharacterClipsResponse = await response.json();
        if (!body.success || !body.clips) {
          throw new Error(body.error || 'Failed to load clips');
        }
        // The API already returns clips ordered by views desc (R5.4) — render as-is.
        setClips(body.clips);
        // VODs are surfaced only when present; default to [] otherwise (R7.4).
        setVods(Array.isArray(body.vods) ? body.vods : []);
      } catch (err) {
        console.error('[CharacterClipsPanel] fetch failed:', err);
        setError(err instanceof Error ? err.message : 'Failed to load clips');
        setClips([]);
        setVods([]);
      } finally {
        setLoading(false);
      }
    },
    [username],
  );

  // Platform is part of the panel's scope (it identifies the profile this panel
  // belongs to); referenced here so the prop is part of the public contract and
  // available for future per-platform behavior without changing the signature.
  void platform;

  const hasSelection = selectedCharacter !== null;
  const hasClips = clips.length > 0;
  // Only render the VOD surface when the API returned a NON-EMPTY array (R7.4).
  const hasVods = vods.length > 0;

  return (
    <div className="space-y-4">
      <CharacterCatalog
        entries={entries}
        selectedCharacter={selectedCharacter}
        onSelect={handleSelect}
      />

      {/* Gentle prompt before any selection — only when there are entries. */}
      {entries.length > 0 && !hasSelection && (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-[#26262c] bg-[#18181b]/40 px-4 py-8 text-sm text-[#ADADB8]">
          <MousePointerClick className="h-4 w-4 text-cyan-400/70" aria-hidden="true" />
          Select a character to see their clips.
        </div>
      )}

      {/* Selected-character clip surface. */}
      {hasSelection && (
        <div>
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-[#ADADB8]">
              <Loader2 className="h-4 w-4 animate-spin text-cyan-400" aria-hidden="true" />
              Loading clips…
            </div>
          ) : error ? (
            <div className="py-12 text-center text-sm text-red-300">{error}</div>
          ) : !hasClips ? (
            // No clips for the selected character (R5.5).
            <p className="py-12 text-center text-sm text-[#ADADB8]">
              No clips available for this character yet.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {clips.map((clip) => (
                <ClipCard key={`${clip.platform}:${clip.clipId}`} clip={clip} />
              ))}
            </div>
          )}

          {/* VOD surface: rendered ONLY when a non-empty payload exists (R7.4). */}
          {!loading && !error && hasVods && <VodList vods={vods} />}
        </div>
      )}
    </div>
  );
}

export default CharacterClipsPanel;

import Link from 'next/link';
import {
  Twitch,
  Radio,
  Users,
  Server as ServerIcon,
  Film,
  Eye,
  ExternalLink,
  Clock,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { ViewerTrendChart } from '@/components/streamers/viewer-trend-chart';
import { CharacterClipsPanel } from '@/components/streamers/character-clips-panel';
import type {
  StreamerProfile,
  Clip,
  PlatformIdentity,
  ViewerTrendPoint,
} from '@/lib/streamers';
import type { CharacterCatalogEntry } from '@/lib/streamer-characters';
import type { ServerData } from '@/lib/data';

/** Brand-accurate Kick glyph (lucide has no Kick icon), mirroring the favorites page. */
function KickIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M1.333 0v24h21.334V0H1.333zm17.12 18.347h-4.32l-3.093-4.907-1.653 1.76v3.147H5.654V5.653h3.733v5.28l4.48-5.28h4.427l-4.907 5.44 4.986 7.254h.08z" />
    </svg>
  );
}

/** Platform badge with the platform's brand color + icon. */
function PlatformBadge({ platform }: { platform: 'twitch' | 'kick' }) {
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

/** Small live/offline pill with an optional viewer count (R4.1, R4.4). */
function LiveStatusPill({ isLive, viewerCount }: { isLive: boolean; viewerCount?: number }) {
  if (!isLive) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#26262c] bg-[#18181b]/80 px-3 py-1 text-xs font-medium text-[#ADADB8]">
        <span className="h-2 w-2 rounded-full bg-gray-500" />
        Offline
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-300">
      <Radio className="h-3.5 w-3.5 animate-pulse" />
      LIVE
      {typeof viewerCount === 'number' && (
        <span className="ml-1 inline-flex items-center gap-1 text-red-200">
          <Users className="h-3 w-3" />
          {viewerCount.toLocaleString()}
        </span>
      )}
    </span>
  );
}

/** Profile header: display name, platform, current live status + viewer count (R4.1, R4.4). */
function ProfileHeader({ profile }: { profile: StreamerProfile }) {
  return (
    <Card variant="elevated">
      <CardContent className="flex flex-col gap-4 py-6 sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          {profile.profileImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.profileImageUrl}
              alt={profile.displayName}
              className="h-16 w-16 rounded-full border border-cyan-400/40 object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-cyan-400/30 bg-gradient-to-br from-cyan-500/20 to-purple-500/20">
              <Users className="h-7 w-7 text-cyan-300" />
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-white">{profile.displayName}</h1>
            <div className="mt-2 flex items-center gap-2">
              <PlatformBadge platform={profile.platform} />
              <LiveStatusPill
                isLive={profile.liveStatus.isLive}
                viewerCount={profile.liveStatus.viewerCount}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/** Per-platform identities, each with its own live status (R4.7). */
function PlatformIdentities({ identities }: { identities: PlatformIdentity[] }) {
  if (identities.length === 0) return null;
  return (
    <Card variant="glass">
      <CardContent className="py-5">
        <h2 className="mb-3 text-sm font-semibold text-white">Platform identities</h2>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          {identities.map((identity) => (
            <div
              key={identity.platform}
              className="flex items-center justify-between gap-3 rounded-lg border border-[#26262c] bg-[#18181b]/60 px-4 py-3 sm:min-w-[240px]"
            >
              <div className="flex items-center gap-2">
                <PlatformBadge platform={identity.platform} />
                <span className="text-sm text-gray-300">{identity.username}</span>
              </div>
              <LiveStatusPill isLive={identity.isLive} viewerCount={identity.viewerCount} />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/** List of servers the streamer has been observed playing on (R4.2). */
function ServerList({ servers }: { servers: ServerData[] }) {
  return (
    <Card variant="glass">
      <CardContent className="py-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
          <ServerIcon className="h-4 w-4 text-cyan-400" />
          Servers played
        </h2>
        {servers.length === 0 ? (
          <p className="text-sm text-[#ADADB8]">No servers recorded for this streamer yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {servers.map((server) => (
              <Link
                key={server.server_id}
                href={`/streams/${server.server_id}`}
                className="inline-flex items-center gap-2 rounded-lg border border-[#26262c] bg-[#18181b]/80 px-3 py-2 text-sm text-gray-200 transition-all hover:border-cyan-500/40 hover:text-cyan-200"
              >
                <ServerIcon className="h-3.5 w-3.5 text-cyan-400/80" />
                {server.server_name}
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Format a clip duration in seconds to a compact label. */
function formatDuration(seconds: number): string {
  if (!seconds || seconds < 0) return 'N/A';
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

/** Single clip card (thumbnail, title, view count, external link). */
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

/** Clip history grid sourced from the clips data (R4.3). */
function ClipHistory({ clips }: { clips: Clip[] }) {
  return (
    <Card variant="glass">
      <CardContent className="py-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
          <Film className="h-4 w-4 text-purple-400" />
          Clip history
        </h2>
        {clips.length === 0 ? (
          <p className="text-sm text-[#ADADB8]">No clips recorded for this streamer yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {clips.map((clip) => (
              <ClipCard key={`${clip.platform}:${clip.clipId}`} clip={clip} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface StreamerProfileViewProps {
  profile: StreamerProfile;
  servers: ServerData[];
  clips: Clip[];
  identities: PlatformIdentity[];
  initialTrend: ViewerTrendPoint[];
  initialRange: string;
  /**
   * Whether the independent `character_tracking` feature flag is enabled for
   * this request (R1.2/R1.4 fail-closed). The character surface renders ONLY
   * when this is `true`.
   */
  characterTrackingEnabled: boolean;
  /**
   * Server-derived Character_Catalog (most-recent first). Empty when the flag is
   * disabled (the page skips the fetch entirely) or when no characters exist.
   */
  characterCatalog: CharacterCatalogEntry[];
}

/**
 * Presentational composition of a streamer's profile (R4.1–R4.5, R4.7).
 *
 * Server-renderable: it receives all data already fetched by the page's server
 * component and only delegates the interactive, selectable-range viewer trend
 * to the `ViewerTrendChart` client child.
 */
export function StreamerProfileView({
  profile,
  servers,
  clips,
  identities,
  initialTrend,
  initialRange,
  characterTrackingEnabled,
  characterCatalog,
}: StreamerProfileViewProps) {
  return (
    <div className="space-y-6">
      <ProfileHeader profile={profile} />

      {identities.length > 0 && <PlatformIdentities identities={identities} />}

      <Card variant="glass">
        <CardContent className="py-5">
          <ViewerTrendChart
            username={profile.username}
            platform={profile.platform}
            initialPoints={initialTrend}
            initialRange={initialRange}
          />
        </CardContent>
      </Card>

      <ServerList servers={servers} />

      <ClipHistory clips={clips} />

      {/*
        Character surface (R3.1, R3.5, R8.1) — rendered BELOW the clip history
        and ONLY when the independent `character_tracking` flag is enabled
        (fail-closed: when off the page skips the catalog fetch and this is
        never shown). The client `CharacterClipsPanel` owns selection state and
        fetches a character's clips through the public API route; it renders its
        own "Characters" catalog heading, so we mount it directly in a Card to
        stay visually consistent with the other sections.
      */}
      {characterTrackingEnabled && (
        <Card variant="glass">
          <CardContent className="py-5">
            <CharacterClipsPanel
              username={profile.username}
              platform={profile.platform}
              entries={characterCatalog}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default StreamerProfileView;

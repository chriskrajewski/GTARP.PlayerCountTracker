import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Twitch, Radio, Server as ServerIcon, Users, Clock } from 'lucide-react';
import { CommonLayout } from '@/components/common-layout';
import { Card, CardContent } from '@/components/ui/card';
import { isFeatureFlagEnabled } from '@/lib/feature-flags-server';
import { FEATURE_FLAGS } from '@/lib/feature-flags-constants';
import { listTrackedStreamers, type StreamerSummary, type StreamerPlatform } from '@/lib/streamers';

// Evaluate the feature flag and streamer list per request (not at build time),
// so toggling `streamer_pages` takes effect without a redeploy and the page
// isn't statically prerendered as a 404 while the flag was off.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Streamers | RPStats',
  description: 'Browse tracked GTA RP streamers — servers, clips, live status, and viewer trends.',
};

/** Brand-accurate Kick glyph (lucide has no Kick icon). */
function KickIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M1.333 0v24h21.334V0H1.333zm17.12 18.347h-4.32l-3.093-4.907-1.653 1.76v3.147H5.654V5.653h3.733v5.28l4.48-5.28h4.427l-4.907 5.44 4.986 7.254h.08z" />
    </svg>
  );
}

/** Small platform pill. */
function PlatformPill({ platform }: { platform: StreamerPlatform }) {
  if (platform === 'kick') {
    return (
      <span
        className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium"
        style={{ background: 'rgba(83, 252, 24, 0.15)', color: '#53fc18' }}
      >
        <KickIcon className="h-3 w-3" />
        Kick
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium"
      style={{ background: 'rgba(145, 70, 255, 0.15)', color: '#a855f7' }}
    >
      <Twitch className="h-3 w-3" />
      Twitch
    </span>
  );
}

/** Relative "last seen" label. */
function lastSeenLabel(iso: string | null): string {
  if (!iso) return 'Unknown';
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return 'Unknown';
  const diff = Date.now() - ms;
  const days = Math.floor(diff / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return months < 12 ? `${months}mo ago` : `${Math.floor(months / 12)}y ago`;
}

/** A single streamer card linking to their profile (primary platform). */
function StreamerCard({ streamer }: { streamer: StreamerSummary }) {
  // Link to the first recorded platform (Twitch preferred — already sorted).
  const platform = streamer.platforms[0] ?? 'twitch';
  const href = `/streamers/${platform}/${encodeURIComponent(streamer.username)}`;

  return (
    <Link href={href} className="group block">
      <Card variant="elevated" className="h-full transition-transform group-hover:-translate-y-1">
        <CardContent className="flex h-full flex-col gap-3 p-4">
          <div className="flex items-center gap-3">
            {streamer.profileImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={streamer.profileImageUrl}
                alt={streamer.username}
                className="h-10 w-10 rounded-full border border-cyan-400/30 object-cover"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-cyan-400/30 bg-gradient-to-br from-cyan-500/20 to-purple-500/20">
                <Users className="h-5 w-5 text-cyan-300" />
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate font-semibold text-white">{streamer.username}</p>
              <div className="mt-1 flex flex-wrap items-center gap-1">
                {streamer.platforms.map((p) => (
                  <PlatformPill key={p} platform={p} />
                ))}
              </div>
            </div>
          </div>

          <div className="mt-auto flex items-center justify-between text-xs text-[#ADADB8]">
            <span className="inline-flex items-center gap-1">
              <ServerIcon className="h-3.5 w-3.5 text-cyan-400/70" />
              {streamer.serverCount} server{streamer.serverCount === 1 ? '' : 's'}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 text-purple-400/70" />
              {lastSeenLabel(streamer.lastSeen)}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

/** Empty state when no streamer history has been recorded yet. */
function NoStreamers() {
  return (
    <Card variant="elevated">
      <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-xl"
          style={{
            background:
              'linear-gradient(135deg, rgba(0, 217, 255, 0.2) 0%, rgba(20, 184, 166, 0.1) 100%)',
            border: '1px solid rgba(0, 217, 255, 0.3)',
          }}
        >
          <Radio className="h-6 w-6 text-cyan-400" />
        </div>
        <h2 className="text-lg font-semibold text-white">No streamers yet</h2>
        <p className="max-w-md text-sm text-[#ADADB8]">
          Streamers appear here once they&apos;ve been observed playing on a tracked server.
          Check back soon.
        </p>
      </CardContent>
    </Card>
  );
}

/**
 * Streamers index — browse tracked streamers (R4).
 *
 * SERVER component: fail-closed feature gate via `isFeatureFlagEnabled` +
 * `notFound()` so the page is unreachable by direct URL when `streamer_pages`
 * is disabled (R1.2/R1.4). Data routes through `lib/streamers.ts`.
 */
export default async function StreamersIndexPage() {
  if (!(await isFeatureFlagEnabled(FEATURE_FLAGS.STREAMER_PAGES))) {
    notFound();
  }

  const streamers = await listTrackedStreamers({ limit: 120 });

  return (
    <CommonLayout showBackButton pageTitle="Streamers">
      <div className="mx-auto w-full max-w-5xl px-2 py-6 sm:px-4">
        <div className="mb-6">
          <h1 className="bg-gradient-to-r from-white via-cyan-100 to-teal-200 bg-clip-text text-2xl font-bold text-transparent sm:text-3xl">
            Streamers
          </h1>
          <p className="mt-1 text-sm text-[#ADADB8]">
            Tracked GTA RP streamers — open one for their servers, clips, live status, and viewer
            trends.
          </p>
        </div>

        {streamers.length === 0 ? (
          <NoStreamers />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {streamers.map((streamer) => (
              <StreamerCard key={streamer.username} streamer={streamer} />
            ))}
          </div>
        )}
      </div>
    </CommonLayout>
  );
}

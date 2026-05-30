import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Frown } from 'lucide-react';
import { CommonLayout } from '@/components/common-layout';
import { Card, CardContent } from '@/components/ui/card';
import { isFeatureFlagEnabled } from '@/lib/feature-flags-server';
import { FEATURE_FLAGS } from '@/lib/feature-flags-constants';
import {
  getStreamerProfile,
  getStreamerServers,
  getStreamerClips,
  getStreamerViewerTrend,
  linkPlatformIdentities,
  type StreamerPlatform,
} from '@/lib/streamers';
import {
  getCharacterCatalog,
  type CharacterCatalogEntry,
} from '@/lib/streamer-characters';
import { StreamerProfileView } from '@/components/streamers/streamer-profile-view';

// Evaluate the feature flag and streamer data per request (not at build time),
// so toggling `streamer_pages` takes effect without a redeploy and the page
// isn't statically prerendered as a 404 while the flag was off.
export const dynamic = 'force-dynamic';

/** The range the server pre-fetches the viewer trend for; the chart can change it. */
const INITIAL_TREND_RANGE = '7d';

interface StreamerPageProps {
  params: Promise<{
    platform: string;
    username: string;
  }>;
}

/** Narrow an arbitrary route segment to a supported {@link StreamerPlatform}. */
function parsePlatform(value: string): StreamerPlatform | null {
  const normalized = value.toLowerCase();
  if (normalized === 'twitch' || normalized === 'kick') {
    return normalized;
  }
  return null;
}

/**
 * Optional Open Graph metadata for the Streamer_Profile (nice-to-have). Returns
 * neutral metadata when the feature is disabled so nothing about a gated page
 * leaks; the page render itself still enforces `notFound()`.
 */
export async function generateMetadata({ params }: StreamerPageProps): Promise<Metadata> {
  const { platform, username } = await params;
  const decoded = decodeURIComponent(username ?? '').trim();
  const parsedPlatform = parsePlatform(platform ?? '');

  if (!parsedPlatform || !decoded) {
    return { title: 'Streamer | RPStats' };
  }

  const platformLabel = parsedPlatform === 'kick' ? 'Kick' : 'Twitch';
  return {
    title: `${decoded} on ${platformLabel} | RPStats`,
    description: `Servers, clips, live status, and viewer trends for ${decoded} (${platformLabel}).`,
  };
}

/** Empty-state surface shown when a streamer has no recorded history (R4.6). */
function NoStreamerData({ name }: { name: string }) {
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
          <Frown className="h-6 w-6 text-cyan-400" />
        </div>
        <h2 className="text-lg font-semibold text-white">No data available</h2>
        <p className="max-w-md text-sm text-[#ADADB8]">
          We don&apos;t have any recorded history for{' '}
          <span className="font-medium text-cyan-300">{name}</span> yet — no servers, clips, or
          stream activity. Check back later once we&apos;ve observed this streamer.
        </p>
      </CardContent>
    </Card>
  );
}

/**
 * Streamer_Profile page (R4 — task 10.6).
 *
 * SERVER component: it gates server-side with `isFeatureFlagEnabled` +
 * `notFound()` (so a disabled feature is unreachable even by direct URL, R1.2/
 * R1.4) and calls the service-role-backed `lib/streamers.ts` reads directly
 * (these must run server-side). Only the selectable-range viewer trend is an
 * interactive client child (`ViewerTrendChart`), which refetches via the public
 * `/api/streamers/viewer-trend` route — no service-role code reaches the client.
 */
export default async function StreamerPage({ params }: StreamerPageProps) {
  const { platform: platformParam, username: usernameParam } = await params;

  // Fail-closed feature gate (R1.2/R1.4): unreachable when disabled.
  if (!(await isFeatureFlagEnabled(FEATURE_FLAGS.STREAMER_PAGES))) {
    notFound();
  }

  const platform = parsePlatform(platformParam ?? '');
  if (!platform) {
    notFound();
  }

  // The username segment may be URL-encoded (spaces, unicode, etc.).
  const username = decodeURIComponent(usernameParam ?? '').trim();
  if (!username) {
    notFound();
  }

  // Fetch the profile first — `null` is the authoritative no-data signal (R4.6).
  const profile = await getStreamerProfile(platform, username);

  if (!profile) {
    return (
      <CommonLayout showBackButton pageTitle="Streamer">
        <NoStreamerData name={username} />
      </CommonLayout>
    );
  }

  // Fetch the remaining surfaces in parallel (R4.2, R4.3, R4.5, R4.7).
  const [servers, clips, identities, initialTrend] = await Promise.all([
    getStreamerServers(username),
    getStreamerClips(username, platform),
    linkPlatformIdentities(username),
    getStreamerViewerTrend(username, INITIAL_TREND_RANGE, platform),
  ]);

  // The character surface has its OWN independent fail-closed flag (R1.2/R1.4),
  // evaluated per request so toggling propagates without a redeploy (R1.3). When
  // disabled we do NOT fetch the catalog and pass an empty list so the surface
  // stays hidden (fail closed).
  const characterTrackingEnabled = await isFeatureFlagEnabled(
    FEATURE_FLAGS.CHARACTER_TRACKING,
  );
  const characterCatalog: CharacterCatalogEntry[] = characterTrackingEnabled
    ? await getCharacterCatalog(username)
    : [];

  return (
    <CommonLayout showBackButton pageTitle={`Streamer: ${profile.displayName}`}>
      <StreamerProfileView
        profile={profile}
        servers={servers}
        clips={clips}
        identities={identities}
        initialTrend={initialTrend}
        initialRange={INITIAL_TREND_RANGE}
        characterTrackingEnabled={characterTrackingEnabled}
        characterCatalog={characterCatalog}
      />
    </CommonLayout>
  );
}

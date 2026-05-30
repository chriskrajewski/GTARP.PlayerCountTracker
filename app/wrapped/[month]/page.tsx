import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CalendarDays, Crown, Sparkles, TrendingUp } from 'lucide-react';
import { CommonLayout } from '@/components/common-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShareLink } from '@/components/wrapped/share-link';
import { isFeatureFlagEnabled } from '@/lib/feature-flags-server';
import { FEATURE_FLAGS } from '@/lib/feature-flags-constants';
import { getServers } from '@/lib/data';
import { getReportByMonth, isValidMonth, type InsightsReport } from '@/lib/insights';
import {
  formatDayLabel,
  formatGrowth,
  formatMonthLabel,
  formatNumber,
} from '@/lib/insights-format';

// Evaluate the feature flag and report per request (not at build time), so
// toggling `insights_wrapped` takes effect without a redeploy and the page
// isn't statically prerendered as a 404 while the flag was off.
export const dynamic = 'force-dynamic';

interface WrappedReportPageProps {
  params: Promise<{ month: string }>;
}

/**
 * Open Graph + Twitter metadata for a single report (R5.4). Next.js auto-wires
 * the sibling `opengraph-image.tsx` as the OG/Twitter image for this route, so
 * we don't hardcode the image URL — we only set a good title/description and the
 * large-image Twitter card. Returns neutral metadata when the feature is
 * disabled or the report is missing so nothing about a gated/absent report
 * leaks.
 */
export async function generateMetadata({ params }: WrappedReportPageProps): Promise<Metadata> {
  const { month } = await params;

  const neutral: Metadata = {
    title: 'Wrapped | RPStats',
    description: 'Monthly recaps of GTA RP server activity.',
    robots: { index: false, follow: false },
  };

  if (!isValidMonth(month)) return neutral;
  if (!(await isFeatureFlagEnabled(FEATURE_FLAGS.INSIGHTS_WRAPPED))) return neutral;

  const report = await getReportByMonth(month);
  if (!report) return neutral;

  const label = formatMonthLabel(month);
  const title = `${label} Wrapped | RPStats`;
  const description = `The GTA RP server highlights for ${label}: peak day, busiest server, and biggest mover.`;

  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
      type: 'article',
      url: `/wrapped/${month}`,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

/** A single metric tile. `unavailable` renders an explicit label (R5.3). */
function MetricCard({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Card variant="elevated" className="h-full">
      <CardContent className="flex h-full flex-col gap-3 p-5">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-[#ADADB8]">
          {icon}
          {label}
        </div>
        <div className="flex flex-1 flex-col justify-center">{children}</div>
      </CardContent>
    </Card>
  );
}

/**
 * Explicit "not available" state for a metric the series couldn't support
 * (R5.3) — NEVER a fabricated or zero value.
 */
function MetricUnavailable() {
  return (
    <div className="flex flex-col gap-1">
      <Badge variant="outline" className="w-fit">
        Not enough data
      </Badge>
      <p className="text-xs text-[#6b6b73]">This metric couldn&apos;t be computed for this month.</p>
    </div>
  );
}

/** The three-metric body of the report. */
function ReportMetrics({
  report,
  serverNameById,
}: {
  report: InsightsReport;
  serverNameById: Map<string, string>;
}) {
  const { peakDay, busiestServer, momGrowth } = report.metrics;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {/* Peak-activity day */}
      <MetricCard icon={<CalendarDays className="h-3.5 w-3.5 text-cyan-400" />} label="Peak day">
        {peakDay.available ? (
          <div className="flex flex-col gap-1">
            <span className="text-xl font-semibold text-white">{formatDayLabel(peakDay.day)}</span>
            <span className="text-sm text-[#ADADB8]">
              {formatNumber(peakDay.activity)} total player-samples
            </span>
          </div>
        ) : (
          <MetricUnavailable />
        )}
      </MetricCard>

      {/* Busiest server */}
      <MetricCard icon={<Crown className="h-3.5 w-3.5 text-yellow-400" />} label="Busiest server">
        {busiestServer.available ? (
          <div className="flex flex-col gap-1">
            <span className="text-xl font-semibold text-white">
              {serverNameById.get(busiestServer.serverId) ?? busiestServer.serverId}
            </span>
            <span className="text-sm text-[#ADADB8]">
              {formatNumber(busiestServer.total)} total players
            </span>
          </div>
        ) : (
          <MetricUnavailable />
        )}
      </MetricCard>

      {/* Largest month-over-month growth */}
      <MetricCard
        icon={<TrendingUp className="h-3.5 w-3.5 text-emerald-400" />}
        label="Biggest mover"
      >
        {momGrowth.available ? (
          <div className="flex flex-col gap-1">
            <span className="text-xl font-semibold text-white">
              {serverNameById.get(momGrowth.serverId) ?? momGrowth.serverId}
            </span>
            <span className="text-sm text-emerald-400">
              {formatGrowth(momGrowth.growth)} vs. prior month
            </span>
            <span className="text-xs text-[#6b6b73]">
              {formatNumber(momGrowth.previousTotal)} → {formatNumber(momGrowth.currentTotal)}
            </span>
          </div>
        ) : (
          <MetricUnavailable />
        )}
      </MetricCard>
    </div>
  );
}

/**
 * Single Insights_Report page (R5.3, R5.4 / task 11.7).
 *
 * SERVER component. Validates the month, fail-closed feature gate, then loads
 * the retained report. The page is public and keyed by month, so `/wrapped/{month}`
 * is itself the canonical shareable link that renders the same report for any
 * visitor (R5.4); a copyable share control is surfaced via `ShareLink`. Each
 * metric renders an explicit "Not enough data" label when unavailable (R5.3).
 */
export default async function WrappedReportPage({ params }: WrappedReportPageProps) {
  const { month } = await params;

  if (!isValidMonth(month)) {
    notFound();
  }

  // Fail-closed feature gate (R1.2/R1.4).
  if (!(await isFeatureFlagEnabled(FEATURE_FLAGS.INSIGHTS_WRAPPED))) {
    notFound();
  }

  const report = await getReportByMonth(month);
  if (!report) {
    notFound();
  }

  const servers = await getServers();
  const serverNameById = new Map(servers.map((s) => [s.server_id, s.server_name]));

  const label = formatMonthLabel(report.month);

  return (
    <CommonLayout showBackButton pageTitle={`${label} Wrapped`}>
      <div className="mx-auto w-full max-w-4xl px-2 py-6 sm:px-4">
        <div className="mb-6 flex items-center gap-3">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-xl"
            style={{
              background:
                'linear-gradient(135deg, rgba(0, 217, 255, 0.2) 0%, rgba(20, 184, 166, 0.1) 100%)',
              border: '1px solid rgba(0, 217, 255, 0.3)',
            }}
          >
            <Sparkles className="h-5 w-5 text-cyan-400" />
          </div>
          <div>
            <h1 className="bg-gradient-to-r from-white via-cyan-100 to-teal-200 bg-clip-text text-2xl font-bold text-transparent sm:text-3xl">
              {label} Wrapped
            </h1>
            <p className="text-sm text-[#ADADB8]">A recap of the month&apos;s server activity.</p>
          </div>
        </div>

        <ReportMetrics report={report} serverNameById={serverNameById} />

        <div className="mt-6">
          <Card variant="glass">
            <CardContent className="p-5">
              <ShareLink path={`/wrapped/${report.month}`} />
            </CardContent>
          </Card>
        </div>
      </div>
    </CommonLayout>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, Crown, Sparkles, Trophy } from 'lucide-react';
import { CommonLayout } from '@/components/common-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { isFeatureFlagEnabled } from '@/lib/feature-flags-server';
import { FEATURE_FLAGS } from '@/lib/feature-flags';
import { getServers } from '@/lib/data';
import { listReports, type InsightsReportSummary } from '@/lib/insights';
import { formatMonthLabel, formatNumber } from '@/lib/insights-format';

/** Wrapped is gated; keep the route out of search indexes regardless. */
export const metadata: Metadata = {
  title: 'Wrapped | RPStats',
  description: 'Monthly recaps of GTA RP server activity.',
  robots: { index: false, follow: false },
};

/**
 * A single report card linking to its month page. Shows the busiest-server
 * headline as a preview when that metric is available (R5.3 — never a fabricated
 * value; we simply omit the preview when unavailable).
 */
function ReportCard({
  report,
  serverName,
}: {
  report: InsightsReportSummary;
  serverName: string | null;
}) {
  const busiest = report.busiestServer;
  return (
    <Link href={`/wrapped/${report.month}`} className="group block">
      <Card variant="elevated" className="h-full transition-transform group-hover:-translate-y-1">
        <CardContent className="flex h-full flex-col gap-4 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-lg"
                style={{
                  background:
                    'linear-gradient(135deg, rgba(0, 217, 255, 0.2) 0%, rgba(20, 184, 166, 0.1) 100%)',
                  border: '1px solid rgba(0, 217, 255, 0.3)',
                }}
              >
                <Sparkles className="h-4 w-4 text-cyan-400" />
              </div>
              <h2 className="text-lg font-semibold text-white">
                {formatMonthLabel(report.month)}
              </h2>
            </div>
            <ArrowRight className="h-4 w-4 text-[#ADADB8] transition-colors group-hover:text-cyan-400" />
          </div>

          <div className="mt-auto">
            {busiest.available ? (
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-[#ADADB8]">
                  <Crown className="h-3.5 w-3.5 text-yellow-400" />
                  Busiest server
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-white">
                    {serverName ?? busiest.serverId}
                  </span>
                  <Badge variant="secondary">{formatNumber(busiest.total)} players</Badge>
                </div>
              </div>
            ) : (
              <Badge variant="outline">Highlights inside</Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

/** Empty state shown before any monthly report has been generated (R5.6). */
function NoReports() {
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
          <Trophy className="h-6 w-6 text-cyan-400" />
        </div>
        <h2 className="text-lg font-semibold text-white">No reports yet</h2>
        <p className="max-w-md text-sm text-[#ADADB8]">
          Monthly Wrapped recaps appear here once a calendar month completes and its report is
          generated. Check back after the end of the month.
        </p>
      </CardContent>
    </Card>
  );
}

/**
 * Wrapped index — the retained monthly reports list (R5.6 / task 11.7).
 *
 * SERVER component: fail-closed feature gate via `isFeatureFlagEnabled` +
 * `notFound()` so the page is unreachable by direct URL when `insights_wrapped`
 * is disabled (R1.2/R1.4). Reads route entirely through `lib/insights.ts` and
 * `getServers()` (no parallel queries, R9.3).
 */
export default async function WrappedIndexPage() {
  // Fail-closed feature gate (R1.2/R1.4).
  if (!(await isFeatureFlagEnabled(FEATURE_FLAGS.INSIGHTS_WRAPPED))) {
    notFound();
  }

  const [reports, servers] = await Promise.all([listReports(), getServers()]);
  const serverNameById = new Map(servers.map((s) => [s.server_id, s.server_name]));

  return (
    <CommonLayout showBackButton pageTitle="Wrapped">
      <div className="mx-auto w-full max-w-5xl px-2 py-6 sm:px-4">
        <div className="mb-6">
          <h1 className="bg-gradient-to-r from-white via-cyan-100 to-teal-200 bg-clip-text text-2xl font-bold text-transparent sm:text-3xl">
            Monthly Wrapped
          </h1>
          <p className="mt-1 text-sm text-[#ADADB8]">
            Shareable recaps of GTA RP server activity, one for each completed month.
          </p>
        </div>

        {reports.length === 0 ? (
          <NoReports />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {reports.map((report) => (
              <ReportCard
                key={report.month}
                report={report}
                serverName={
                  report.busiestServer.available
                    ? serverNameById.get(report.busiestServer.serverId) ?? null
                    : null
                }
              />
            ))}
          </div>
        )}
      </div>
    </CommonLayout>
  );
}

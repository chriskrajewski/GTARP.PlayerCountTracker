import { ImageResponse } from 'next/og';
import { FEATURE_FLAGS } from '@/lib/feature-flags-constants';
import { isFeatureFlagEnabled } from '@/lib/feature-flags-server';
import { getReportByMonth, isValidMonth, type InsightsReport } from '@/lib/insights';
import { formatGrowth, formatMonthLabel, formatNumber } from '@/lib/insights-format';

/** Standard Open Graph / Twitter large-image dimensions. */
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
/** Re-render on demand and let the route handle freshness; reports are immutable. */
export const runtime = 'nodejs';

const BG = '#0a0a0c';
const CYAN = '#00D9FF';
const TEAL = '#14b8a6';
const MUTED = '#ADADB8';

/** One headline stat row in the social card. */
function StatRow({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', fontSize: 22, color: MUTED, textTransform: 'uppercase', letterSpacing: 2 }}>
        {label}
      </div>
      <div style={{ display: 'flex', fontSize: 40, color: accent, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

/** The branded frame shared by both the report and fallback renders. */
function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        padding: 64,
        backgroundColor: BG,
        backgroundImage: `radial-gradient(circle at 0% 0%, rgba(0,217,255,0.18) 0%, transparent 45%), radial-gradient(circle at 100% 100%, rgba(20,184,166,0.16) 0%, transparent 45%)`,
        color: '#ffffff',
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div
          style={{
            display: 'flex',
            fontSize: 30,
            fontWeight: 700,
            color: CYAN,
            letterSpacing: 1,
          }}
        >
          RPStats
        </div>
        <div style={{ display: 'flex', fontSize: 30, color: MUTED }}>Wrapped</div>
      </div>
      {children}
    </div>
  );
}

/**
 * Build the rich social card for a loaded report. Each metric falls back to a
 * neutral "Not enough data" string when unavailable (R5.3) — never a fabricated
 * value.
 */
function ReportImage(report: InsightsReport): React.ReactElement {
  const { peakDay, busiestServer, momGrowth } = report.metrics;

  return (
    <Frame>
      <div style={{ display: 'flex', flexDirection: 'column', marginTop: 24, gap: 8 }}>
        <div style={{ display: 'flex', fontSize: 68, fontWeight: 800 }}>
          {formatMonthLabel(report.month)}
        </div>
        <div style={{ display: 'flex', fontSize: 28, color: MUTED }}>
          A recap of the month&apos;s GTA RP server activity
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          marginTop: 'auto',
          gap: 48,
          paddingTop: 40,
          borderTop: `2px solid rgba(0,217,255,0.3)`,
        }}
      >
        <StatRow
          label="Peak day"
          value={peakDay.available ? peakDay.day : 'Not enough data'}
          accent={CYAN}
        />
        <StatRow
          label="Busiest server"
          value={busiestServer.available ? `${formatNumber(busiestServer.total)} players` : 'Not enough data'}
          accent="#facc15"
        />
        <StatRow
          label="Biggest mover"
          value={momGrowth.available ? formatGrowth(momGrowth.growth) : 'Not enough data'}
          accent={TEAL}
        />
      </div>
    </Frame>
  );
}

/** Generic branded card used whenever a report can't be loaded (R5.5). */
function FallbackImage(month: string): React.ReactElement {
  const label = isValidMonth(month) ? formatMonthLabel(month) : 'Monthly recap';
  return (
    <Frame>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          margin: 'auto 0',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', fontSize: 72, fontWeight: 800 }}>{label}</div>
        <div style={{ display: 'flex', fontSize: 30, color: MUTED }}>
          GTA RP server activity recap
        </div>
      </div>
    </Frame>
  );
}

/**
 * On-demand social share image for an Insights_Report (R5.5).
 *
 * R5.5 / design ("fallback image, not 500, on load failure"): every path
 * returns a valid {@link ImageResponse}. The report load is wrapped in
 * try/catch and any failure (invalid month, disabled feature, missing report,
 * or a thrown read error) renders the generic {@link FallbackImage} rather than
 * throwing a 500. The feature flag is checked so a disabled feature yields only
 * the generic fallback, never the gated report's metrics.
 */
export default async function Image({ params }: { params: Promise<{ month: string }> }) {
  const { month } = await params;

  try {
    if (!isValidMonth(month)) {
      return new ImageResponse(FallbackImage(month), size);
    }
    if (!(await isFeatureFlagEnabled(FEATURE_FLAGS.INSIGHTS_WRAPPED))) {
      return new ImageResponse(FallbackImage(month), size);
    }
    const report = await getReportByMonth(month);
    if (!report) {
      return new ImageResponse(FallbackImage(month), size);
    }
    return new ImageResponse(ReportImage(report), size);
  } catch {
    // Never 500 — always emit a valid image (R5.5).
    return new ImageResponse(FallbackImage(month), size);
  }
}

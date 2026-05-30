'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  Time,
  ColorType,
  LineStyle,
  CrosshairMode,
  AreaSeries,
} from 'lightweight-charts';
import { Loader2, TrendingUp } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ViewerTrendPoint, StreamerPlatform } from '@/lib/streamers';

/** The selectable ranges (R4.5). Kept in sync with the API route's allow-list. */
const RANGE_OPTIONS: { value: string; label: string }[] = [
  { value: '24h', label: 'Last 24 hours' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
];

interface ViewerTrendChartProps {
  /** Streamer username the trend is scoped to. */
  username: string;
  /** Platform scope (the profile's platform); omitted server-side combines both. */
  platform: StreamerPlatform;
  /** Server-rendered initial trend (R4.5) so the chart paints without a fetch. */
  initialPoints: ViewerTrendPoint[];
  /** The range the initial points were fetched for. */
  initialRange?: string;
}

/**
 * Selectable-range viewer-trend chart for the Streamer_Profile page (R4.5).
 *
 * This is the only interactive (client) piece of the otherwise server-rendered
 * profile page. It receives the INITIAL trend from the server component, renders
 * it with the project's `lightweight-charts` stack (a simplified single-series
 * variant of `components/comparison/comparison-chart.tsx`), and refetches a new
 * trend from the public `/api/streamers/viewer-trend` route when the viewer
 * changes the range — so the service-role `lib/streamers.ts` reads stay
 * server-side (R9.1/R9.3).
 */
export function ViewerTrendChart({
  username,
  platform,
  initialPoints,
  initialRange = '7d',
}: ViewerTrendChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Area'> | null>(null);

  const [range, setRange] = useState<string>(initialRange);
  const [points, setPoints] = useState<ViewerTrendPoint[]>(initialPoints);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Format the time-axis label based on the selected range.
  const formatTime = useCallback(
    (timestamp: number): string => {
      const date = new Date(timestamp * 1000);
      if (range === '24h') {
        return date.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        });
      }
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    },
    [range],
  );

  // Create the chart once on mount.
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 300,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#EFEFF1',
      },
      grid: {
        vertLines: { color: 'rgba(75, 85, 99, 0.1)', style: LineStyle.Dashed },
        horzLines: { color: 'rgba(75, 85, 99, 0.1)', style: LineStyle.Dashed },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: 'rgba(0, 217, 255, 0.4)', width: 1, style: LineStyle.Dashed },
        horzLine: { color: 'rgba(0, 217, 255, 0.4)', width: 1, style: LineStyle.Dashed },
      },
      rightPriceScale: {
        borderColor: 'rgba(75, 85, 99, 0.3)',
        entireTextOnly: true,
      },
      localization: {
        priceFormatter: (price: number) => Math.round(price).toString(),
      },
      timeScale: {
        borderColor: 'rgba(75, 85, 99, 0.3)',
        timeVisible: true,
        secondsVisible: false,
        tickMarkFormatter: (time: Time) => formatTime(time as number),
      },
    });

    chartRef.current = chart;

    const series = chart.addSeries(AreaSeries, {
      lineColor: 'rgb(0, 217, 255)',
      topColor: 'rgba(0, 217, 255, 0.4)',
      bottomColor: 'rgba(0, 217, 255, 0.02)',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 4,
    });
    seriesRef.current = series;

    const handleResize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
    // formatTime is intentionally excluded — the tick formatter reads the latest
    // `range` via the ref-stable closure re-applied below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the time-axis formatter in sync with the selected range.
  useEffect(() => {
    chartRef.current?.applyOptions({
      timeScale: { tickMarkFormatter: (time: Time) => formatTime(time as number) },
    });
  }, [formatTime]);

  // Push the current points into the series whenever they change.
  useEffect(() => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (!series || !chart) return;

    const data = points
      .map((p) => ({
        time: Math.floor(new Date(p.timestamp).getTime() / 1000) as Time,
        value: p.viewerCount,
      }))
      .filter((point) => !Number.isNaN(point.time as number))
      // lightweight-charts requires strictly ascending, unique time values.
      .filter((point, index, arr) => index === 0 || point.time !== arr[index - 1].time);

    series.setData(data);
    chart.timeScale().fitContent();
  }, [points]);

  // Refetch the trend when the viewer changes the range (R4.5).
  const handleRangeChange = useCallback(
    async (nextRange: string) => {
      setRange(nextRange);
      setLoading(true);
      setError(null);
      try {
        const url = new URL('/api/streamers/viewer-trend', window.location.origin);
        url.searchParams.set('username', username);
        url.searchParams.set('platform', platform);
        url.searchParams.set('range', nextRange);

        const response = await fetch(url.toString());
        if (!response.ok) {
          throw new Error(`Request failed (${response.status})`);
        }
        const body: { success: boolean; points?: ViewerTrendPoint[]; error?: string } =
          await response.json();
        if (!body.success || !body.points) {
          throw new Error(body.error || 'Failed to load viewer trend');
        }
        setPoints(body.points);
      } catch (err) {
        console.error('[ViewerTrendChart] refetch failed:', err);
        setError(err instanceof Error ? err.message : 'Failed to load viewer trend');
      } finally {
        setLoading(false);
      }
    },
    [username, platform],
  );

  const hasData = points.length > 0;

  return (
    <div className="w-full">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-medium text-white">
          <TrendingUp className="h-4 w-4 text-cyan-400" />
          Viewer trend
        </div>
        <div className="flex items-center gap-2">
          {loading && <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />}
          <div className="w-[160px]">
            <Select value={range} onValueChange={handleRangeChange}>
              <SelectTrigger aria-label="Select viewer trend time range">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RANGE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {error ? (
        <div className="py-12 text-center text-sm text-red-300">{error}</div>
      ) : !hasData && !loading ? (
        <div className="py-12 text-center text-sm text-[#ADADB8]">
          No viewer history recorded for this range.
        </div>
      ) : null}

      {/* The chart container always mounts so the chart instance is stable; it is
          visually empty when there is no data, with the message shown above. */}
      <div
        ref={containerRef}
        className="h-[300px] w-full"
        style={{ display: hasData ? 'block' : 'none' }}
      />
    </div>
  );
}

export default ViewerTrendChart;

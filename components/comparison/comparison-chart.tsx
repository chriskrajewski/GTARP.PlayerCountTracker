'use client';

import { useEffect, useRef } from 'react';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  Time,
  ColorType,
  LineStyle,
  CrosshairMode,
  LineSeries,
} from 'lightweight-charts';
import type { ComparisonChartModel } from '@/lib/comparison-prefs';
import type { TimeRange } from '@/lib/data';

interface ComparisonChartProps {
  /** Built by `buildComparisonChartModel` — one series per pinned server (R2.1). */
  model: ComparisonChartModel;
  /** server_id -> display name for the legend. */
  serverNames: Record<string, string>;
  /** Selected range, used only to format the time axis. */
  timeRange: TimeRange;
}

/**
 * Convert an `hsl(...)` string to `rgb(...)` so lightweight-charts (which does
 * not accept hsl line colors reliably across versions) renders the exact color
 * carried by each series. Falls back to the original string if it is not hsl.
 */
function hslToRgb(hsl: string): string {
  const m = hsl.match(/hsl\(\s*(\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?)%,\s*(\d+(?:\.\d+)?)%\s*\)/);
  if (!m) return hsl;
  const h = parseFloat(m[1]) / 360;
  const s = parseFloat(m[2]) / 100;
  const l = parseFloat(m[3]) / 100;
  let r: number;
  let g: number;
  let b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      let tt = t;
      if (tt < 0) tt += 1;
      if (tt > 1) tt -= 1;
      if (tt < 1 / 6) return p + (q - p) * 6 * tt;
      if (tt < 1 / 2) return q;
      if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
}

/**
 * Overlaid multi-series player-count chart for the Comparison View (R2.1).
 *
 * This is a thin wrapper over the existing `lightweight-charts` stack (the same
 * library used by `player-count-chart-lw.tsx`). Rather than fetching its own
 * colors, it consumes the `ComparisonChartModel` directly — each series already
 * carries the color assigned by `assignSeriesColors`, so the chart series and
 * the summary stat cards stay perfectly consistent (R2.8).
 */
export function ComparisonChart({ model, serverNames, timeRange }: ComparisonChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Line'>[]>([]);

  // Format the time axis label based on the selected range.
  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp * 1000);
    if (
      timeRange === 'live' ||
      timeRange === '1h' ||
      timeRange === '2h' ||
      timeRange === '4h' ||
      timeRange === '6h' ||
      timeRange === '8h' ||
      timeRange === '24h'
    ) {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    }
    if (timeRange === '7d' || timeRange === '30d' || timeRange === '90d') {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  // Create the chart once on mount.
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 400,
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
        vertLine: { color: 'rgba(239, 239, 241, 0.3)', width: 1, style: LineStyle.Dashed },
        horzLine: { color: 'rgba(239, 239, 241, 0.3)', width: 1, style: LineStyle.Dashed },
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
      seriesRef.current = [];
    };
  }, []);

  // Rebuild series whenever the model or range changes (R2.6 recompute).
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    // Clear previous series.
    seriesRef.current.forEach((s) => chart.removeSeries(s));
    seriesRef.current = [];

    model.series.forEach((series) => {
      const lineSeries = chart.addSeries(LineSeries, {
        color: hslToRgb(series.color),
        lineWidth: 2,
        lineStyle: LineStyle.Solid,
        priceLineVisible: false,
        lastValueVisible: true,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4,
      });

      const data = series.points
        .map((p) => ({
          time: Math.floor(new Date(p.timestamp).getTime() / 1000) as Time,
          value: p.value,
        }))
        // De-duplicate identical timestamps (lightweight-charts requires strictly
        // ascending, unique time values) keeping the last value for a timestamp.
        .filter((point, index, arr) => index === 0 || point.time !== arr[index - 1].time);

      lineSeries.setData(data);
      seriesRef.current.push(lineSeries);
    });

    chart.timeScale().fitContent();
  }, [model, timeRange]);

  return (
    <div className="w-full">
      {/* Legend — color swatch per pinned server (R2.8 consistency). */}
      <div className="flex flex-wrap gap-3 mb-3 px-2">
        {model.series.map((series) => (
          <div key={series.serverId} className="flex items-center gap-2">
            <div
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '2px',
                backgroundColor: hslToRgb(series.color),
              }}
            />
            <span style={{ color: '#EFEFF1', fontSize: '13px' }}>
              {serverNames[series.serverId] || `Server ${series.serverId}`}
            </span>
          </div>
        ))}
      </div>

      <div ref={containerRef} className="h-[400px] w-full" />
    </div>
  );
}

export default ComparisonChart;

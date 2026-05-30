import { NextRequest, NextResponse } from 'next/server';
import { validateAdminRequest } from '@/lib/admin-auth-server';
import {
  loadAnomalyConfig,
  saveAnomalyConfig,
  type AnomalyConfig,
} from '@/lib/anomaly';

/**
 * Admin endpoints for the Anomaly_Detector detection thresholds (R7.7).
 *
 * All persistence routes through `lib/anomaly.ts`
 * (`loadAnomalyConfig`/`saveAnomalyConfig`, backed by the `anomaly_config`
 * system setting, R9.1). Both handlers use the same admin auth guard as the
 * other admin monitoring routes (`validateAdminRequest`).
 */

/** Coerce an incoming value to a finite number, or `undefined` when not parseable. */
function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

/**
 * GET /api/admin/monitoring/anomaly-config
 * Returns the effective anomaly detection thresholds (R7.7).
 */
export async function GET(request: NextRequest) {
  try {
    if (!validateAdminRequest(request)) {
      return NextResponse.json(
        { success: false, error: 'Admin authentication required' },
        { status: 401 },
      );
    }

    const config = await loadAnomalyConfig();

    return NextResponse.json({
      success: true,
      data: config,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Anomaly config load error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/admin/monitoring/anomaly-config
 * Update the anomaly detection thresholds (R7.7). Accepts a partial body and
 * merges it over the current persisted config before saving.
 */
export async function PATCH(request: NextRequest) {
  try {
    if (!validateAdminRequest(request)) {
      return NextResponse.json(
        { success: false, error: 'Admin authentication required' },
        { status: 401 },
      );
    }

    const body = await request.json().catch(() => ({}));

    const current = await loadAnomalyConfig();
    const next: AnomalyConfig = {
      thresholdPercent: toFiniteNumber(body.thresholdPercent) ?? current.thresholdPercent,
      minChange: toFiniteNumber(body.minChange) ?? current.minChange,
      dedupWindowMinutes: toFiniteNumber(body.dedupWindowMinutes) ?? current.dedupWindowMinutes,
    };

    await saveAnomalyConfig(next);

    return NextResponse.json({
      success: true,
      data: next,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Anomaly config save error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { validateAdminRequest } from '@/lib/admin-auth-server';
import { getServers } from '@/lib/data';
import { getAnomaliesForServer, type AnomalyRecord } from '@/lib/anomaly';

/**
 * GET /api/admin/monitoring/anomalies
 *
 * Returns recent recorded anomalies across all tracked servers for the admin
 * monitoring view (R7.4). All reads route through `lib/anomaly.ts`
 * (`getAnomaliesForServer`) per tracked server (R9.1); the results are merged
 * and sorted by `created_at` desc and capped by `limit`. Each row is annotated
 * with the server's display name for convenience.
 *
 * Uses the same admin auth guard as the other admin monitoring routes
 * (`validateAdminRequest`).
 */

/** Anomaly row enriched with the server's display name for the admin UI. */
type AdminAnomaly = AnomalyRecord & { server_name: string };

export async function GET(request: NextRequest) {
  try {
    if (!validateAdminRequest(request)) {
      return NextResponse.json(
        { success: false, error: 'Admin authentication required' },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10) || 50, 200);
    const activeOnly = searchParams.get('active') === 'true';

    const servers = await getServers();
    const nameById = new Map(servers.map((s) => [s.server_id, s.server_name]));

    // Pull each server's recent anomalies through the lib reader (R9.1), then
    // merge + sort by created_at desc and cap to `limit`.
    const perServer = await Promise.all(
      servers.map((s) =>
        getAnomaliesForServer(s.server_id, { limit, activeOnly }),
      ),
    );

    const merged: AdminAnomaly[] = perServer
      .flat()
      .map((row) => ({
        ...row,
        server_name: nameById.get(row.server_id) ?? row.server_id,
      }))
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
      .slice(0, limit);

    return NextResponse.json({
      success: true,
      data: merged,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Anomaly history error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}

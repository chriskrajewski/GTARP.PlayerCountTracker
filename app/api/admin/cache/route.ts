import { NextRequest, NextResponse } from 'next/server';
import { validateAdminRequest } from '@/lib/admin-auth-server';
import { getAPICache } from '@/lib/api-cache';

/**
 * API Cache Management Endpoint
 * 
 * GET: Retrieve cache configurations and statistics
 * POST: Update cache configuration
 * DELETE: Clear cache
 */

export async function GET(request: NextRequest) {
  try {
    if (!validateAdminRequest(request)) {
      return NextResponse.json(
        { success: false, error: 'Admin authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const apiName = searchParams.get('apiName');
    const action = searchParams.get('action');

    const cache = getAPICache();

    // Get all configurations
    if (!apiName) {
      const configs = await cache.getAllConfigs();
      return NextResponse.json({
        success: true,
        data: configs,
        timestamp: new Date().toISOString(),
      });
    }

    // Get statistics for specific API
    if (action === 'stats') {
      const stats = await cache.getStats(apiName);
      if (!stats) {
        return NextResponse.json(
          { success: false, error: 'API cache configuration not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({
        success: true,
        data: stats,
        timestamp: new Date().toISOString(),
      });
    }

    // Get configuration for specific API
    const configs = await cache.getAllConfigs();
    const config = configs.find((c) => c.api_name === apiName);

    if (!config) {
      return NextResponse.json(
        { success: false, error: 'API cache configuration not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: config,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Cache config GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!validateAdminRequest(request)) {
      return NextResponse.json(
        { success: false, error: 'Admin authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { apiName, cache_enabled, cache_ttl_seconds, description } = body as {
      apiName: string;
      cache_enabled?: boolean;
      cache_ttl_seconds?: number;
      description?: string;
    };

    if (!apiName) {
      return NextResponse.json(
        { success: false, error: 'apiName is required' },
        { status: 400 }
      );
    }

    if (cache_ttl_seconds !== undefined && cache_ttl_seconds < 1) {
      return NextResponse.json(
        { success: false, error: 'cache_ttl_seconds must be at least 1' },
        { status: 400 }
      );
    }

    const cache = getAPICache();

    const updates: Record<string, boolean | number> = {};
    if (cache_enabled !== undefined) updates.cache_enabled = cache_enabled;
    if (cache_ttl_seconds !== undefined) updates.cache_ttl_seconds = cache_ttl_seconds;
    if (description !== undefined) updates.description = description;

    const updatedConfig = await cache.updateConfig(apiName, updates);

    if (!updatedConfig) {
      return NextResponse.json(
        { success: false, error: 'Failed to update cache configuration' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updatedConfig,
      message: 'Cache configuration updated successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Cache config POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!validateAdminRequest(request)) {
      return NextResponse.json(
        { success: false, error: 'Admin authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const apiName = searchParams.get('apiName');

    if (!apiName) {
      return NextResponse.json(
        { success: false, error: 'apiName is required' },
        { status: 400 }
      );
    }

    const cache = getAPICache();
    const success = await cache.clear(apiName);

    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Failed to clear cache' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Cache cleared for ${apiName}`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Cache config DELETE error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { validateAdminRequest } from '@/lib/admin-auth-server';
import { FeatureFlag } from '@/lib/admin-types';

export async function GET(request: NextRequest) {
  try {
    if (!validateAdminRequest(request)) {
      return NextResponse.json(
        { success: false, error: 'Admin authentication required' },
        { status: 401 }
      );
    }

    // Since you don't have feature flags in your database, return empty array
    // In a real implementation, you would have a feature_flags table
    return NextResponse.json({
      success: true,
      data: [],
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Feature flags API error:', error);
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
    
    // Mock creating a new feature flag
    const newFeatureFlag: FeatureFlag = {
      id: Date.now().toString(),
      name: body.name,
      description: body.description,
      is_enabled: body.is_enabled || false,
      environment: body.environment || 'development',
      rollout_percentage: body.rollout_percentage || 0,
      conditions: body.conditions || {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: 'admin',
    };

    return NextResponse.json({
      success: true,
      data: newFeatureFlag,
      message: 'Feature flag created successfully',
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Feature flag creation error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
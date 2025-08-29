import { NextRequest, NextResponse } from 'next/server';
import { validateAdminRequest } from '@/lib/admin-auth-server';
import { SystemConfiguration } from '@/lib/admin-types';

export async function GET(request: NextRequest) {
  try {
    if (!validateAdminRequest(request)) {
      return NextResponse.json(
        { success: false, error: 'Admin authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');

    // System configuration from environment variables
    // In a real implementation, you would store these in a configurations table
    const envConfigurations: SystemConfiguration[] = [
      {
        id: 'twitch_client_id',
        category: 'api',
        key: 'twitch_client_id',
        value: process.env.TWITCH_CLIENT_ID ? '********' : 'not_configured',
        description: 'Twitch API Client ID',
        data_type: 'string',
        is_sensitive: true,
        is_readonly: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: 'system',
        updated_by: 'system',
      },
      {
        id: 'twitch_client_secret',
        category: 'api',
        key: 'twitch_client_secret',
        value: process.env.TWITCH_CLIENT_SECRET ? '********' : 'not_configured',
        description: 'Twitch API Client Secret',
        data_type: 'string',
        is_sensitive: true,
        is_readonly: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: 'system',
        updated_by: 'system',
      },
      {
        id: 'supabase_url',
        category: 'database',
        key: 'supabase_url',
        value: process.env.NEXT_PUBLIC_SUPABASE_URL ? '********' : 'not_configured',
        description: 'Supabase Project URL',
        data_type: 'string',
        is_sensitive: true,
        is_readonly: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: 'system',
        updated_by: 'system',
      },
      {
        id: 'admin_token',
        category: 'security',
        key: 'admin_token',
        value: process.env.ADMIN_TOKEN ? '********' : 'not_configured',
        description: 'Admin Authentication Token',
        data_type: 'string',
        is_sensitive: true,
        is_readonly: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: 'system',
        updated_by: 'system',
      },
    ];

    // Filter by category if specified
    let filteredConfigs = envConfigurations;
    if (category) {
      filteredConfigs = envConfigurations.filter(config => config.category === category);
    }

    return NextResponse.json({
      success: true,
      data: filteredConfigs,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('System config API error:', error);
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
    
    // Mock creating a new configuration
    const newConfig: SystemConfiguration = {
      id: Date.now().toString(),
      category: body.category,
      key: body.key,
      value: body.value,
      description: body.description,
      data_type: body.data_type || 'string',
      is_sensitive: body.is_sensitive || false,
      is_readonly: body.is_readonly || false,
      validation_rules: body.validation_rules,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: 'admin',
      updated_by: 'admin',
    };

    return NextResponse.json({
      success: true,
      data: newConfig,
      message: 'Configuration created successfully',
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('System config creation error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
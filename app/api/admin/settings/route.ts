import { NextRequest, NextResponse } from 'next/server';
import { validateAdminRequest } from '@/lib/admin-auth-server';
import { getSystemSettingRecord, listSystemSettings, upsertSystemSetting } from '@/lib/system-settings';

export async function GET(request: NextRequest) {
  try {
    if (!validateAdminRequest(request)) {
      return NextResponse.json(
        { success: false, error: 'Admin authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');
    const category = searchParams.get('category');

    if (key) {
      const setting = await getSystemSettingRecord(key, { bustCache: searchParams.get('bustCache') === 'true' });
      if (!setting) {
        return NextResponse.json(
          { success: false, error: 'Setting not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: setting,
        timestamp: new Date().toISOString(),
      });
    }

    const settings = await listSystemSettings(category || undefined);

    return NextResponse.json({
      success: true,
      data: settings,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[AdminSettings] GET error:', error);
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
    const { key, value, data_type, description, category } = body as {
      key?: string;
      value?: any;
      data_type?: 'string' | 'number' | 'boolean' | 'json';
      description?: string;
      category?: string;
    };

    if (!key) {
      return NextResponse.json(
        { success: false, error: 'key is required' },
        { status: 400 }
      );
    }

    if (value === undefined) {
      return NextResponse.json(
        { success: false, error: 'value is required' },
        { status: 400 }
      );
    }

    const updated = await upsertSystemSetting({
      key,
      value,
      data_type,
      description,
      category,
      updated_by: 'admin_portal',
    });

    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'Failed to update setting' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Setting updated successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[AdminSettings] POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

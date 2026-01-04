import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';
import type { Database } from '@/lib/supabase.types';
import { rateLimiter } from '@/lib/rateLimiter';

interface RemoveFavoriteBody {
  clip_id: string;
  platform: 'twitch' | 'kick';
}

/**
 * DELETE /api/favorites/remove
 *
 * Remove a clip from the authenticated user's favorites.
 */
export async function DELETE(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimiter(request);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase credentials not configured');
    }

    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as RemoveFavoriteBody;

    if (!body?.clip_id || !body?.platform) {
      return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
    }

    const { data: appUser, error: appUserError } = await supabase
      .from('app_users')
      .select('id')
      .eq('auth_user_id', user.id)
      .single();

    if (appUserError || !appUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const { error } = await supabase
      .from('user_favorites')
      .delete()
      .eq('user_id', appUser.id)
      .eq('clip_id', body.clip_id)
      .eq('platform', body.platform);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Server error' },
      { status: 500 }
    );
  }
}

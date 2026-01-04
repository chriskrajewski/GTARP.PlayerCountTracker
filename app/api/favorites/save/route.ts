import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';
import type { Database } from '@/lib/supabase.types';
import { rateLimiter } from '@/lib/rateLimiter';
import { getOrCreateAppUser } from '@/lib/app-users';

interface SaveFavoriteBody {
  clip_id: string;
  platform: 'twitch' | 'kick';
  notes?: string;
  categories?: string[];
}

/**
 * POST /api/favorites/save
 *
 * Save or update a user's favorite clip.
 */
export async function POST(request: NextRequest) {
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

    const body = (await request.json()) as SaveFavoriteBody;

    if (!body?.clip_id || !body?.platform) {
      return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
    }

    if (body.platform !== 'twitch' && body.platform !== 'kick') {
      return NextResponse.json({ success: false, error: 'Invalid platform' }, { status: 400 });
    }

    const { appUser, error: appUserError } = await getOrCreateAppUser(supabase, user);

    if (appUserError || !appUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const categories = Array.isArray(body.categories) ? body.categories : undefined;

    const { data, error } = await supabase
      .from('user_favorites')
      .upsert([
        {
          user_id: appUser.id,
          clip_id: body.clip_id,
          platform: body.platform,
          notes: body.notes,
          categories,
        },
      ], {
        onConflict: 'user_id,clip_id,platform',
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Server error' },
      { status: 500 }
    );
  }
}

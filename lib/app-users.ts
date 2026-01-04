import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase.types';

export interface AppUserResult {
  appUser: { id: number } | null;
  error: Error | null;
}

export async function getOrCreateAppUser(
  supabase: SupabaseClient<Database>,
  user: User
): Promise<AppUserResult> {
  const { data: existingUser, error: existingError } = await supabase
    .from('app_users')
    .select('id')
    .eq('auth_user_id', user.id)
    .single();

  if (existingUser) {
    return { appUser: existingUser, error: null };
  }

  if (existingError && existingError.code !== 'PGRST116') {
    return { appUser: null, error: existingError };
  }

  const username =
    user.user_metadata?.name ||
    user.user_metadata?.full_name ||
    user.email?.split('@')[0] ||
    null;

  const { data: createdUser, error: insertError } = await supabase
    .from('app_users')
    .insert([
      {
        auth_user_id: user.id,
        discord_id: user.user_metadata?.provider_id,
        username,
        avatar_url: user.user_metadata?.avatar_url,
        last_login_at: new Date().toISOString(),
      },
    ])
    .select('id')
    .single();

  if (insertError || !createdUser) {
    return { appUser: null, error: insertError || new Error('Failed to create user') };
  }

  return { appUser: createdUser, error: null };
}

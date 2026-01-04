"use client";

import { createBrowserClient, waitForSessionRestoration } from '@/lib/supabase-browser';
import type { User } from '@supabase/supabase-js';

export interface AuthResult {
  user: User | null;
  error: Error | null;
}

/**
 * Get current authenticated user (client-side)
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    await waitForSessionRestoration();
    const supabase = createBrowserClient();
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      console.error('Error getting session:', sessionError);
      return null;
    }

    if (session?.user) {
      return session.user;
    }

    const { data: { user }, error } = await supabase.auth.getUser();

    if (error) {
      console.error('Error getting current user:', error);
      return null;
    }

    return user || null;
  } catch (error) {
    console.error('Error in getCurrentUser:', error);
    return null;
  }
}

/**
 * Sign in with Discord OAuth
 */
export async function signInWithDiscordOAuth(): Promise<AuthResult> {
  try {
    const supabase = createBrowserClient();
    const redirectUrl = `${window.location.origin}/auth/callback`;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: {
        redirectTo: redirectUrl,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (error) {
      return { user: null, error };
    }

    return { user: null, error: null };
  } catch (error) {
    return {
      user: null,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

/**
 * Handle OAuth callback and ensure app user profile exists
 */
export async function handleOAuthCallback(): Promise<AuthResult> {
  try {
    const supabase = createBrowserClient();
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session?.user) {
      return {
        user: null,
        error: sessionError || new Error('No session found after OAuth callback'),
      };
    }

    const { data: appUser, error: userError } = await supabase
      .from('app_users')
      .select('id')
      .eq('auth_user_id', session.user.id)
      .single();

    if (userError && userError.code === 'PGRST116') {
      const { error: insertError } = await supabase
        .from('app_users')
        .insert([
          {
            auth_user_id: session.user.id,
            discord_id: session.user.user_metadata?.provider_id,
            username: session.user.user_metadata?.name || session.user.email?.split('@')[0],
            avatar_url: session.user.user_metadata?.avatar_url,
            last_login_at: new Date().toISOString(),
          },
        ]);

      if (insertError) {
        return { user: null, error: insertError };
      }
    } else if (userError) {
      return { user: null, error: userError };
    } else if (appUser) {
      await supabase
        .from('app_users')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', appUser.id);
    }

    return { user: session.user, error: null };
  } catch (error) {
    return {
      user: null,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

/**
 * Sign out current user
 */
export async function signOutUser(): Promise<{ error: Error | null }> {
  try {
    const supabase = createBrowserClient();
    const { error } = await supabase.auth.signOut();
    return { error };
  } catch (error) {
    return {
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

/**
 * Listen to user auth state changes
 */
export function onUserAuthStateChange(callback: (user: User | null) => void) {
  const supabase = createBrowserClient();

  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (event, session) => {
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        callback(session?.user || null);
      } else if (event === 'SIGNED_OUT') {
        callback(null);
      }
    }
  );

  return subscription;
}

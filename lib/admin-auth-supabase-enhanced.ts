"use client";

import { createBrowserClient } from '@/lib/supabase-browser';
import { createServerClient } from '@/lib/supabase-server';
import type { User } from '@supabase/supabase-js';

/**
 * Enhanced Admin Authentication with Dynamic OAuth Support
 * 
 * This module handles admin authentication using Supabase Auth with support for:
 * - Email/Password authentication
 * - Dynamic OAuth providers (Discord, Google, GitHub, etc.)
 * - Automatic provider detection from Supabase configuration
 * 
 * Only users in the admin_users table can access the admin panel.
 * 
 * Source: PRD §4.1 FR-9, §5.4; Blueprint §2.3
 */

// ============================================================================
// TYPES
// ============================================================================

export interface OAuthProvider {
  id: string;
  name: string;
  displayName: string;
  icon: string;
  color: string;
  enabled: boolean;
  description?: string;
}

export interface AuthResult {
  user: User | null;
  error: Error | null;
}

// ============================================================================
// CLIENT-SIDE UTILITIES
// ============================================================================

/**
 * Get current authenticated admin user (client-side)
 * Waits for session restoration from storage before checking user
 */
export async function getCurrentAdminUser(): Promise<User | null> {
  try {
    const supabase = createBrowserClient();
    
    // First, try to get the session (which should be restored from storage)
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('Error getting session:', sessionError);
      return null;
    }
    
    // If we have a session, return the user
    if (session?.user) {
      console.log('Session found, user:', session.user.id);
      return session.user;
    }
    
    // If no session, try getUser() as a fallback
    // This handles cases where the session might not be in the session object
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error) {
      console.error('Error getting current user:', error);
      return null;
    }
    
    if (user) {
      console.log('User found via getUser:', user.id);
      return user;
    }
    
    console.log('No user found');
    return null;
  } catch (error) {
    console.error('Error in getCurrentAdminUser:', error);
    return null;
  }
}

/**
 * Check if current user is an admin
 */
export async function isCurrentUserAdmin(): Promise<boolean> {
  try {
    const supabase = createBrowserClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return false;
    }
    
    // Check if user exists in admin_users table
    const { data, error } = await supabase
      .from('admin_users')
      .select('id')
      .eq('auth_user_id', user.id)
      .single();
    
    return !error && !!data;
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}

/**
 * Sign in with email and password
 */
export async function signInAdmin(email: string, password: string): Promise<AuthResult> {
  try {
    const supabase = createBrowserClient();
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) {
      return { user: null, error };
    }
    
    // Verify user is in admin_users table
    if (data.user) {
      const { data: adminUser, error: adminError } = await supabase
        .from('admin_users')
        .select('id')
        .eq('auth_user_id', data.user.id)
        .single();
      
      if (adminError || !adminUser) {
        // User authenticated but not an admin
        await supabase.auth.signOut();
        return { 
          user: null, 
          error: new Error('User is not authorized as an admin') 
        };
      }
    }
    
    return { user: data.user, error: null };
  } catch (error) {
    return { 
      user: null, 
      error: error instanceof Error ? error : new Error(String(error)) 
    };
  }
}

/**
 * Sign in with OAuth provider
 * 
 * @param provider - The OAuth provider ID (e.g., 'discord', 'google', 'github')
 * @returns Promise with user and error
 */
export async function signInWithOAuth(provider: string): Promise<AuthResult> {
  try {
    const supabase = createBrowserClient();
    
    // Get the current URL for the redirect
    const redirectUrl = `${window.location.origin}/admin/auth/callback`;
    
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: provider as any,
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
      error: error instanceof Error ? error : new Error(String(error)) 
    };
  }
}

/**
 * Handle OAuth callback
 * 
 * This function should be called after the user is redirected back from the OAuth provider.
 * It verifies the user is an admin and returns the authenticated user.
 */
export async function handleOAuthCallback(): Promise<AuthResult> {
  try {
    const supabase = createBrowserClient();
    
    // Get the current session (should be set by Supabase after OAuth redirect)
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session?.user) {
      return { 
        user: null, 
        error: sessionError || new Error('No session found after OAuth callback') 
      };
    }
    
    // Verify user is in admin_users table
    const { data: adminUser, error: adminError } = await supabase
      .from('admin_users')
      .select('id')
      .eq('auth_user_id', session.user.id)
      .single();
    
    if (adminError || !adminUser) {
      // User authenticated but not an admin
      await supabase.auth.signOut();
      return { 
        user: null, 
        error: new Error('User is not authorized as an admin') 
      };
    }
    
    return { user: session.user, error: null };
  } catch (error) {
    return { 
      user: null, 
      error: error instanceof Error ? error : new Error(String(error)) 
    };
  }
}

/**
 * Sign out current admin user
 */
export async function signOutAdmin(): Promise<{ error: Error | null }> {
  try {
    const supabase = createBrowserClient();
    const { error } = await supabase.auth.signOut();
    return { error };
  } catch (error) {
    return { 
      error: error instanceof Error ? error : new Error(String(error)) 
    };
  }
}

/**
 * Listen to auth state changes
 * Handles both initial session restoration and subsequent auth changes
 */
export function onAuthStateChange(callback: (user: User | null) => void) {
  const supabase = createBrowserClient();
  
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (event, session) => {
      // Handle initial session restoration
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session?.user) {
          // Verify user is still an admin
          const isAdmin = await isCurrentUserAdmin();
          if (isAdmin) {
            callback(session.user);
          } else {
            // User lost admin status
            await supabase.auth.signOut();
            callback(null);
          }
        } else {
          callback(null);
        }
      } else if (event === 'SIGNED_OUT') {
        callback(null);
      }
    }
  );
  
  return subscription;
}

/**
 * Fetch available OAuth providers from the API
 * 
 * This function dynamically fetches the list of enabled OAuth providers
 * from Supabase, so new providers can be added without code changes.
 */
export async function getAvailableOAuthProviders(): Promise<OAuthProvider[]> {
  try {
    const response = await fetch('/api/admin/auth-providers', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('Failed to fetch OAuth providers:', response.status);
      return [];
    }

    const data = await response.json();
    return data.providers || [];
  } catch (error) {
    console.error('Error fetching OAuth providers:', error);
    return [];
  }
}

// ============================================================================
// SERVER-SIDE UTILITIES
// ============================================================================

/**
 * Verify admin user from request (server-side)
 * Used in API routes to check if request is from authenticated admin
 */
export async function verifyAdminFromRequest(request: Request): Promise<{ userId: string | null; error: Error | null }> {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return { userId: null, error: new Error('Missing authorization header') };
    }
    
    const token = authHeader.substring(7);
    
    // Verify token with Supabase
    const supabase = createServerClient();
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return { userId: null, error: error || new Error('Invalid token') };
    }
    
    // Check if user is in admin_users table
    const { data: adminUser, error: adminError } = await supabase
      .from('admin_users')
      .select('id')
      .eq('auth_user_id', user.id)
      .single();
    
    if (adminError || !adminUser) {
      return { userId: null, error: new Error('User is not authorized as an admin') };
    }
    
    return { userId: user.id, error: null };
  } catch (error) {
    return { 
      userId: null, 
      error: error instanceof Error ? error : new Error(String(error)) 
    };
  }
}

/**
 * Get admin user by ID (server-side)
 */
export async function getAdminUserById(userId: string): Promise<{ email: string | null; error: Error | null }> {
  try {
    const supabase = createServerClient();
    
    const { data, error } = await supabase
      .from('admin_users')
      .select('email')
      .eq('auth_user_id', userId)
      .single();
    
    if (error) {
      return { email: null, error };
    }
    
    return { email: data?.email || null, error: null };
  } catch (error) {
    return { 
      email: null, 
      error: error instanceof Error ? error : new Error(String(error)) 
    };
  }
}


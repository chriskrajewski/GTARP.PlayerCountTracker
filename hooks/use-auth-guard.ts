"use client";

import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { getCurrentUser } from '@/lib/user-auth-supabase';

/**
 * Redirect to /auth when no user session exists
 */
export function useAuthGuard() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    /**
     * Validate the current session and redirect if missing.
     */
    const checkAuth = async () => {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      if (!currentUser && typeof window !== 'undefined') {
        window.location.href = '/auth';
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  return { user, loading };
}

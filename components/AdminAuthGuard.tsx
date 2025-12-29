'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase-browser';
import type { User } from '@supabase/supabase-js';

/**
 * AdminAuthGuard Component
 * 
 * Protects admin-only content with Supabase authentication
 * Source: PRD §4.1 FR-9; Blueprint §5.1
 * Implements: Admin-only access control
 */
export function AdminAuthGuard({
  children,
  fallback = null
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const checkAuth = async () => {
      try {
        // Get current user
        // Source: PRD §4.1 FR-9 (Admin authentication)
        const {
          data: { user: currentUser },
          error: userError
        } = await supabase.auth.getUser();

        if (userError || !currentUser) {
          if (isMounted) {
            setUser(null);
            setIsAdmin(false);
            setLoading(false);
            // Redirect to login
            router.push('/login');
          }
          return;
        }

        // Check if user is admin
        // Source: PRD §7.1 O-4 (Admin verification)
        const { data: adminData, error: adminError } = await supabase
          .from('admin_users')
          .select('id')
          .eq('auth_user_id', currentUser.id)
          .single();

        if (isMounted) {
          setUser(currentUser);
          setIsAdmin(!!adminData && !adminError);
          setLoading(false);

          // Redirect if not admin
          if (!adminData || adminError) {
            router.push('/');
          }
        }
      } catch (error) {
        console.error('Auth check error:', error);
        if (isMounted) {
          setUser(null);
          setIsAdmin(false);
          setLoading(false);
          router.push('/login');
        }
      }
    };

    checkAuth();

    // Listen for auth changes
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        if (isMounted) {
          setUser(null);
          setIsAdmin(false);
          router.push('/login');
        }
      }
    });

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, [router]);

  // Loading state
  if (loading) {
    return fallback || <div className="p-4">Loading...</div>;
  }

  // Not authenticated or not admin
  if (!user || !isAdmin) {
    return fallback || <div className="p-4">Access denied</div>;
  }

  // Authenticated admin - show content
  // Source: PRD §6.1 V-1 (User sees: Visitor count only after auth)
  return <>{children}</>;
}

"use client";

import React, { useState, useEffect, lazy, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, EyeOff, Shield, Mail, Lock, AlertCircle } from 'lucide-react';
import { signOutAdmin, getCurrentAdminUser, onAuthStateChange } from '@/lib/admin-auth-supabase-enhanced';
import { waitForSessionRestoration } from '@/lib/supabase-browser';
import type { User } from '@supabase/supabase-js';

// Lazy load the enhanced login component to avoid circular dependencies
const EnhancedAdminLogin = lazy(() => 
  import('@/components/admin-login-enhanced').then(mod => ({ default: mod.AdminLogin }))
);

/**
 * Admin Login Component
 * 
 * Handles Supabase authentication for admin users.
 * Only users in the admin_users table can access the admin panel.
 * 
 * Source: PRD §4.1 FR-9, §5.4; Blueprint §2.3
 */

interface AdminLoginProps {
  onAuthSuccess?: () => void;
}

export function AdminLogin({ onAuthSuccess }: AdminLoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password');
      setIsLoading(false);
      return;
    }

    try {
      const { user, error: signInError } = await signInAdmin(email, password);
      
      if (signInError) {
        setError(signInError.message || 'Authentication failed. Please check your credentials.');
        setIsLoading(false);
        return;
      }
      
      if (user) {
        setEmail('');
        setPassword('');
        if (onAuthSuccess) {
          onAuthSuccess();
        }
        // Redirect to admin dashboard
        router.push('/admin');
      }
    } catch (error) {
      console.error('Login error:', error);
      setError('An error occurred during authentication. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0e0e10] to-[#1a1a1e] flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-[#1a1a1e] border-[#26262c] shadow-2xl">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="p-3 rounded-full bg-[#9147ff]/20 border border-[#9147ff]/30">
              <Shield className="h-8 w-8 text-[#9147ff]" />
            </div>
          </div>
          <div>
            <CardTitle className="text-2xl font-bold text-white">
              Admin Access
            </CardTitle>
            <CardDescription className="text-[#ADADB8] mt-2">
              Sign in to access the admin dashboard
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Field */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-white">
                Email Address
              </Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-[#ADADB8]" />
                </div>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  className="bg-[#26262c] border-[#40404a] text-white pl-10 focus:border-[#9147ff] focus:ring-[#9147ff]/20"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-white">
                Password
              </Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-[#ADADB8]" />
                </div>
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="bg-[#26262c] border-[#40404a] text-white pl-10 pr-10 focus:border-[#9147ff] focus:ring-[#9147ff]/20"
                  required
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#ADADB8] hover:text-white transition-colors"
                  disabled={isLoading}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Error Alert */}
            {error && (
              <Alert className="bg-red-900/20 border-red-600/50">
                <AlertCircle className="h-4 w-4 text-red-400" />
                <AlertDescription className="text-red-400 ml-2">
                  {error}
                </AlertDescription>
              </Alert>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#9147ff] hover:bg-[#772ce8] text-white font-medium transition-colors"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  Signing in...
                </div>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>

          {/* Security Notice */}
          <div className="mt-6 p-4 bg-[#26262c]/50 rounded-lg border border-[#40404a]">
            <h4 className="text-sm font-medium text-white mb-2 flex items-center gap-2">
              <Shield className="h-4 w-4 text-[#9147ff]" />
              Security Notice
            </h4>
            <p className="text-xs text-[#ADADB8] leading-relaxed">
             Only authorized admins can access this system. Your credentials are securely transmitted.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Protected Admin Wrapper Component
 * 
 * Wraps admin pages to ensure only authenticated admins can access them.
 * Source: PRD §4.1 FR-9, §5.4
 */

interface AdminProtectedProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function AdminProtected({ children, fallback }: AdminProtectedProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;
    let subscriptionUnsubscribe: (() => void) | null = null;

    const initializeAuth = async () => {
      try {
        // First, wait for session to be restored from storage
        await waitForSessionRestoration();

        if (!isMounted) return;

        // Set up the auth state listener to catch session restoration
        const subscription = onAuthStateChange((authUser) => {
          if (isMounted) {
            setUser(authUser);
            if (!authUser && !isLoading) {
              // Only redirect if we've finished initial load and user is null
              router.push('/admin/login');
            }
          }
        });
        subscriptionUnsubscribe = subscription?.unsubscribe || null;

        // Then check current user (this will trigger the listener if session exists)
        const currentUser = await getCurrentAdminUser();
        if (isMounted) {
          setUser(currentUser);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        if (isMounted) {
          setUser(null);
          setIsLoading(false);
        }
      }
    };

    initializeAuth();

    return () => {
      isMounted = false;
      subscriptionUnsubscribe?.();
    };
  }, [router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0e0e10] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#9147ff]/20 border-t-[#9147ff] rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white">Verifying access...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Suspense fallback={
        <div className="min-h-screen bg-[#0e0e10] flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-[#9147ff]/20 border-t-[#9147ff] rounded-full animate-spin mx-auto mb-4" />
            <p className="text-white">Loading login...</p>
          </div>
        </div>
      }>
        {fallback || <EnhancedAdminLogin />}
      </Suspense>
    );
  }

  return <>{children}</>;
}

/**
 * Admin Logout Button
 * 
 * Handles admin sign out
 */

interface AdminLogoutButtonProps {
  onLogoutComplete?: () => void;
}

export function AdminLogoutButton({ onLogoutComplete }: AdminLogoutButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      const { error } = await signOutAdmin();
      if (error) {
        console.error('Logout error:', error);
      } else {
        if (onLogoutComplete) {
          onLogoutComplete();
        }
        router.push('/admin/login');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={handleLogout}
      disabled={isLoading}
      variant="outline"
      className="bg-transparent border-[#40404a] text-[#ADADB8] hover:bg-red-400/10 hover:text-red-400 hover:border-red-400/30"
    >
      {isLoading ? 'Signing out...' : 'Sign Out'}
    </Button>
  );
}

"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { handleOAuthCallback } from '@/lib/admin-auth-supabase-enhanced';

/**
 * OAuth Callback Handler
 * 
 * This page handles the redirect from OAuth providers after authentication.
 * It verifies the user is an admin and redirects to the admin dashboard.
 * 
 * URL: /admin/auth/callback
 */

export default function OAuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    const processCallback = async () => {
      try {
        const { user, error: callbackError } = await handleOAuthCallback();

        if (callbackError) {
          console.error('OAuth callback error:', callbackError);
          setError(callbackError.message || 'Authentication failed');
          setIsProcessing(false);
          return;
        }

        if (user) {
          // Redirect to admin dashboard
          router.push('/admin');
        } else {
          setError('No user information received');
          setIsProcessing(false);
        }
      } catch (err) {
        console.error('Error processing OAuth callback:', err);
        setError('An error occurred during authentication');
        setIsProcessing(false);
      }
    };

    processCallback();
  }, [router]);

  if (isProcessing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0e0e10] to-[#1a1a1e] flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#9147ff]/20 border-t-[#9147ff] rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white">Completing authentication...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0e0e10] to-[#1a1a1e] flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="mb-4 text-red-400 text-4xl">⚠️</div>
          <h1 className="text-2xl font-bold text-white mb-2">Authentication Failed</h1>
          <p className="text-[#ADADB8] mb-6">{error}</p>
          <a
            href="/admin/login"
            className="inline-block px-6 py-2 bg-[#9147ff] hover:bg-[#772ce8] text-white font-medium rounded-lg transition-colors"
          >
            Back to Login
          </a>
        </div>
      </div>
    );
  }

  return null;
}


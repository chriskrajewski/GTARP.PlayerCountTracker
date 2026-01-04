"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, ShieldCheck } from 'lucide-react';
import { getCurrentUser, signInWithDiscordOAuth } from '@/lib/user-auth-supabase';

/**
 * User login page for Discord OAuth
 */
export default function AuthPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    /**
     * Check for an existing session and redirect if authenticated.
     */
    const checkUser = async () => {
      const user = await getCurrentUser();
      if (user) {
        router.replace('/clips');
        return;
      }
      setLoading(false);
    };

    checkUser();
  }, [router]);

  /**
   * Begin the Discord OAuth flow.
   */
  const handleSignIn = async () => {
    setSigningIn(true);
    setError(null);
    const { error: signInError } = await signInWithDiscordOAuth();
    if (signInError) {
      setError(signInError.message || 'Failed to start Discord sign in');
      setSigningIn(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-md bg-[#15161b]/90 border-[#26262c]">
        <CardHeader className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="p-3 rounded-full bg-cyan-500/10 border border-cyan-500/20">
              <ShieldCheck className="h-7 w-7 text-cyan-300" />
            </div>
          </div>
          <CardTitle className="text-2xl text-white">Sign in</CardTitle>
          <CardDescription className="text-[#ADADB8]">
            Use Discord to access your clip favorites
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert className="bg-red-900/20 border-red-500/30 text-red-200">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Button
            onClick={handleSignIn}
            disabled={signingIn}
            className="w-full bg-[#5865F2] hover:bg-[#4752c4] text-white"
          >
            {signingIn ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Redirecting to Discord...
              </span>
            ) : (
              'Continue with Discord'
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

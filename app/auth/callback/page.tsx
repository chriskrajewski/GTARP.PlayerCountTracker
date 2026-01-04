"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle } from 'lucide-react';
import { handleOAuthCallback } from '@/lib/user-auth-supabase';

/**
 * OAuth callback handler for Discord sign-in
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    /**
     * Finalize OAuth callback and redirect on success.
     */
    const completeSignIn = async () => {
      const { error: callbackError } = await handleOAuthCallback();
      if (callbackError) {
        setError(callbackError.message || 'Failed to complete sign in');
        return;
      }
      router.replace('/clips');
    };

    completeSignIn();
  }, [router]);

  if (!error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-2 text-white">
          <Loader2 className="h-5 w-5 animate-spin text-cyan-400" />
          Finishing sign in...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-md bg-[#15161b]/90 border-[#26262c]">
        <CardHeader className="space-y-2">
          <CardTitle className="text-white flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            Sign in failed
          </CardTitle>
          <CardDescription className="text-[#ADADB8]">
            {error}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => router.replace('/auth')} className="w-full">
            Try again
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

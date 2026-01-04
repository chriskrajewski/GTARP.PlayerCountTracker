"use client";

import { useEffect, useState } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { signInWithDiscordOAuth } from '@/lib/user-auth-supabase';

interface LoginModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
}

/**
 * LoginModal Component
 * 
 * A reusable modal dialog for user authentication via Discord OAuth.
 * Used when the user attempts to access features requiring authentication
 * (e.g., saving favorites) without being logged in.
 */
export function LoginModal({
  isOpen,
  onOpenChange,
  title = "Sign in to continue",
  description = "Log in with Discord to save and manage your favorite clips.",
}: LoginModalProps) {
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Handle Discord OAuth sign-in initiation
   */
  const handleSignIn = async () => {
    setSigningIn(true);
    setError(null);

    const { error: signInError } = await signInWithDiscordOAuth();
    
    if (signInError) {
      setError(signInError.message || 'Failed to initiate Discord sign in');
      setSigningIn(false);
    }
    // Note: OAuth flow will redirect away from the app, so we don't need to handle
    // closing the modal or resetting state on success
  };

  // Reset error state when modal is closed
  useEffect(() => {
    if (!isOpen) {
      setError(null);
      setSigningIn(false);
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="p-3 rounded-full bg-cyan-500/10 border border-cyan-500/20">
              <ShieldCheck className="h-7 w-7 text-cyan-300" />
            </div>
          </div>
          <DialogTitle className="text-2xl">{title}</DialogTitle>
          <DialogDescription className="text-gray-400">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-6">
          {error && (
            <Alert className="bg-red-900/20 border-red-500/30 text-red-200">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button
            onClick={handleSignIn}
            disabled={signingIn}
            className="w-full bg-[#5865F2] hover:bg-[#4752c4] text-white font-medium"
            size="lg"
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

          <p className="text-xs text-center text-gray-500">
            We only use Discord for authentication and to display your username.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, EyeOff, Shield, Mail, Lock, AlertCircle, Loader2 } from 'lucide-react';
import { signInAdmin, signInWithOAuth, getAvailableOAuthProviders, onAuthStateChange } from '@/lib/admin-auth-supabase-enhanced';
import { waitForSessionRestoration } from '@/lib/supabase-browser';
import type { User } from '@supabase/supabase-js';
import type { OAuthProvider } from '@/lib/admin-auth-supabase-enhanced';

interface AdminLoginProps {
  onAuthSuccess?: () => void;
}

/**
 * Provider icon component - renders appropriate icon for each OAuth provider
 */
function ProviderIcon({ provider }: { provider: OAuthProvider }) {
  const iconClass = "h-5 w-5";
  
  switch (provider.id) {
    case 'discord':
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="currentColor">
          <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.211.375-.444.864-.607 1.25a18.27 18.27 0 0 0-5.487 0c-.163-.386-.395-.875-.607-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.873-1.295 1.226-1.994a.076.076 0 0 0-.042-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.294.075.075 0 0 1 .078-.01c3.928 1.793 8.18 1.793 12.062 0a.075.075 0 0 1 .079.009c.12.098.246.198.373.295a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.076.076 0 0 0-.041.107c.36.698.77 1.364 1.225 1.994a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.057c.5-4.761-.838-8.898-3.549-12.55a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-.965-2.157-2.156 0-1.193.964-2.157 2.157-2.157 1.193 0 2.156.964 2.156 2.157 0 1.19-.963 2.156-2.156 2.156zm7.975 0c-1.183 0-2.157-.965-2.157-2.156 0-1.193.964-2.157 2.157-2.157 1.193 0 2.157.964 2.157 2.157 0 1.19-.964 2.156-2.157 2.156z" />
        </svg>
      );
    case 'google':
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="currentColor">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
      );
    case 'github':
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v 3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
        </svg>
      );
    case 'microsoft':
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="currentColor">
          <path d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zm12.6 0H12.6V0H24v11.4z"/>
        </svg>
      );
    case 'twitch':
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="currentColor">
          <path d="M11.571 4.714h1.429v4.286h-1.429V4.714zM17.143 4.714h1.429v4.286h-1.429V4.714zM6 0L3.857 3.429v16.571h5.714v3.429h3.429l3.429-3.429h5.714L24 12.571V0H6zm13.571 11.571l-3.429 3.429h-5.714l-3.429 3.429v-3.429H6.857V1.429h12.714v10.142z"/>
        </svg>
      );
    default:
      return <Shield className={iconClass} />;
  }
}

export function AdminLogin({ onAuthSuccess }: AdminLoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [oauthProviders, setOauthProviders] = useState<OAuthProvider[]>([]);
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);
  const router = useRouter();

  // Load available OAuth providers on mount
  useEffect(() => {
    const loadProviders = async () => {
      try {
        const providers = await getAvailableOAuthProviders();
        setOauthProviders(providers);
      } catch (err) {
        console.error('Failed to load OAuth providers:', err);
      }
    };

    loadProviders();
  }, []);

  const handleEmailPasswordSubmit = async (e: React.FormEvent) => {
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
        setError(signInError.message || 'Authentication failed');
        setIsLoading(false);
        return;
      }
      
      if (user) {
        setEmail('');
        setPassword('');
        if (onAuthSuccess) onAuthSuccess();
        router.push('/admin');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('An error occurred during authentication');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthSignIn = async (provider: OAuthProvider) => {
    setError('');
    setLoadingProvider(provider.id);

    try {
      const { error: oauthError } = await signInWithOAuth(provider.id);
      
      if (oauthError) {
        setError(oauthError.message || `Failed to sign in with ${provider.displayName}`);
        setLoadingProvider(null);
      }
      // If successful, the user will be redirected to the OAuth provider
    } catch (err) {
      console.error('OAuth error:', err);
      setError('An error occurred during OAuth authentication');
      setLoadingProvider(null);
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
            <CardTitle className="text-2xl font-bold text-white">Admin Access</CardTitle>
            <CardDescription className="text-[#ADADB8] mt-2">
              Sign in to access the admin dashboard
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* OAuth Providers */}
          {oauthProviders.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs text-[#ADADB8] font-medium">Sign in with</p>
              <div className="grid grid-cols-2 gap-2">
                {oauthProviders.map((provider) => (
                  <button
                    key={provider.id}
                    onClick={() => handleOAuthSignIn(provider)}
                    disabled={loadingProvider !== null}
                    className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-[#40404a] bg-[#26262c] hover:bg-[#2a2a30] text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      borderColor: loadingProvider === provider.id ? provider.color : '#40404a',
                    }}
                    title={provider.description}
                  >
                    {loadingProvider === provider.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <div style={{ color: provider.color }}>
                        <ProviderIcon provider={provider} />
                      </div>
                    )}
                    <span className="text-sm font-medium hidden sm:inline">{provider.displayName}</span>
                  </button>
                ))}
              </div>
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#40404a]" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-[#1a1a1e] text-[#ADADB8]">or</span>
                </div>
              </div>
            </div>
          )}

          {/* Email/Password Form */}
          <form onSubmit={handleEmailPasswordSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-white">Email Address</Label>
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
                  disabled={isLoading || loadingProvider !== null}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-white">Password</Label>
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
                  disabled={isLoading || loadingProvider !== null}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#ADADB8] hover:text-white transition-colors"
                  disabled={isLoading || loadingProvider !== null}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <Alert className="bg-red-900/20 border-red-600/50">
                <AlertCircle className="h-4 w-4 text-red-400" />
                <AlertDescription className="text-red-400 ml-2">{error}</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              disabled={isLoading || loadingProvider !== null}
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


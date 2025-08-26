"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, EyeOff, Shield, Lock } from 'lucide-react';
import { useAdminAuth } from '@/lib/admin-auth';

interface AdminLoginProps {
  onAuthSuccess?: () => void;
}

export function AdminLogin({ onAuthSuccess }: AdminLoginProps) {
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAdminAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (!token.trim()) {
      setError('Please enter an admin token');
      setIsLoading(false);
      return;
    }

    try {
      const success = await login(token.trim());
      
      if (success) {
        setToken('');
        if (onAuthSuccess) {
          onAuthSuccess();
        }
      } else {
        setError('Invalid admin token. Please check your credentials.');
      }
    } catch (error) {
      console.error('Login error:', error);
      setError('An error occurred during authentication. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-[#0e0e10] border-[#26262c]">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-full bg-[#004D61]/20">
              <Shield className="h-8 w-8 text-[#004D61]" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-white">
            Admin Access Required
          </CardTitle>
          <CardDescription className="text-[#ADADB8]">
            Enter your admin token to access the notification banner management panel
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="token" className="text-white">
                Admin Token
              </Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-[#ADADB8]" />
                </div>
                <Input
                  id="token"
                  type={showToken ? 'text' : 'password'}
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Enter your admin token"
                  className="bg-[#18181b] border-[#26262c] text-white pl-10 pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#ADADB8] hover:text-white"
                >
                  {showToken ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <Alert className="bg-red-900/20 border-red-600/50">
                <AlertDescription className="text-red-400">
                  {error}
                </AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#004D61] hover:bg-[#003a4d] text-white"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  Authenticating...
                </div>
              ) : (
                'Access Admin Panel'
              )}
            </Button>
          </form>

          <div className="mt-6 p-4 bg-[#18181b] rounded-lg border border-[#26262c]">
            <h4 className="text-sm font-medium text-white mb-2">Security Notice</h4>
            <p className="text-xs text-[#ADADB8] leading-relaxed">
              This admin panel is protected by token-based authentication. Only authorized 
              administrators with valid tokens can access the notification banner management 
              system. If you don't have an admin token, please contact your system administrator.
            </p>
          </div>

          <div className="mt-4 text-center">
            <p className="text-xs text-[#ADADB8]">
              Need help? Contact your system administrator
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Protected admin wrapper component
interface AdminProtectedProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function AdminProtected({ children, fallback }: AdminProtectedProps) {
  const { isAuthenticated, isLoading } = useAdminAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#004D61]/20 border-t-[#004D61] rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white">Checking authentication...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return fallback || <AdminLogin />;
  }

  return <>{children}</>;
}

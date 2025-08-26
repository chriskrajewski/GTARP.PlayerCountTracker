"use client";

import { useState, useEffect } from 'react';
import { NextRequest } from 'next/server';

// Admin authentication utilities
export const ADMIN_SESSION_KEY = 'admin_session_token';

// Check if the admin token is valid
export function isValidAdminToken(token: string): boolean {
  const adminToken = process.env.ADMIN_TOKEN;
  
  if (!adminToken) {
    console.error('ADMIN_TOKEN environment variable is not set');
    return false;
  }
  
  return token === adminToken;
}

// Get admin token from request headers or cookies
export function getAdminTokenFromRequest(request: NextRequest): string | null {
  // Check Authorization header first
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  // Check cookies
  const tokenFromCookie = request.cookies.get(ADMIN_SESSION_KEY)?.value;
  if (tokenFromCookie) {
    return tokenFromCookie;
  }
  
  return null;
}

// Validate admin request
export function validateAdminRequest(request: NextRequest): boolean {
  const token = getAdminTokenFromRequest(request);
  if (!token) {
    return false;
  }
  
  return isValidAdminToken(token);
}

// Client-side utilities
export function getStoredAdminToken(): string | null {
  if (typeof window === 'undefined') return null;
  
  try {
    return localStorage.getItem(ADMIN_SESSION_KEY);
  } catch {
    return null;
  }
}

export function setStoredAdminToken(token: string): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(ADMIN_SESSION_KEY, token);
  } catch (error) {
    console.error('Failed to store admin token:', error);
  }
}

export function clearStoredAdminToken(): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.removeItem(ADMIN_SESSION_KEY);
  } catch (error) {
    console.error('Failed to clear admin token:', error);
  }
}

// Validate token with server
export async function validateAdminTokenWithServer(token: string): Promise<boolean> {
  try {
    const response = await fetch('/api/admin/validate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
    
    return response.ok;
  } catch (error) {
    console.error('Failed to validate admin token:', error);
    return false;
  }
}

// Custom hook for admin authentication
export function useAdminAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const storedToken = getStoredAdminToken();
      
      if (!storedToken) {
        setIsAuthenticated(false);
        setIsLoading(false);
        return;
      }
      
      const isValid = await validateAdminTokenWithServer(storedToken);
      
      if (isValid) {
        setToken(storedToken);
        setIsAuthenticated(true);
      } else {
        clearStoredAdminToken();
        setIsAuthenticated(false);
      }
      
      setIsLoading(false);
    };
    
    checkAuth();
  }, []);

  const login = async (inputToken: string): Promise<boolean> => {
    const isValid = await validateAdminTokenWithServer(inputToken);
    
    if (isValid) {
      setStoredAdminToken(inputToken);
      setToken(inputToken);
      setIsAuthenticated(true);
      return true;
    }
    
    return false;
  };

  const logout = () => {
    clearStoredAdminToken();
    setToken(null);
    setIsAuthenticated(false);
  };

  return {
    isAuthenticated,
    isLoading,
    token,
    login,
    logout,
  };
}

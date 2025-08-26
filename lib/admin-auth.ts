"use client";

import { useState, useEffect } from 'react';

// Client-side admin authentication utilities
export const ADMIN_SESSION_KEY = 'admin_session_token';

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

"use client";

import React, { useState, useEffect } from 'react';

/**
 * OAuth Provider Debug Component
 * Shows the status of OAuth provider loading for troubleshooting
 */
export function OAuthProviderDebug() {
  const [providers, setProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDebug, setShowDebug] = useState(false);

  useEffect(() => {
    const fetchProviders = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/admin/auth-providers');
        const data = await response.json();
        
        console.log('OAuth Providers API Response:', data);
        setProviders(data.providers || []);
        
        if (!response.ok) {
          setError(`API Error: ${response.status}`);
        }
      } catch (err) {
        console.error('Error fetching providers:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchProviders();
  }, []);

  if (!showDebug) {
    return (
      <button
        onClick={() => setShowDebug(true)}
        className="fixed bottom-4 right-4 text-xs px-2 py-1 bg-gray-700 text-white rounded opacity-50 hover:opacity-100"
      >
        Debug
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 bg-gray-900 border border-gray-700 rounded p-4 max-w-sm text-xs text-white z-50">
      <div className="flex justify-between items-center mb-2">
        <span className="font-bold">OAuth Debug</span>
        <button
          onClick={() => setShowDebug(false)}
          className="text-gray-400 hover:text-white"
        >
          ✕
        </button>
      </div>
      
      <div className="space-y-2">
        <div>
          <span className="text-gray-400">Status:</span>
          <span className="ml-2">
            {loading ? '⏳ Loading...' : error ? '❌ Error' : '✅ Loaded'}
          </span>
        </div>
        
        {error && (
          <div className="text-red-400">
            <span className="text-gray-400">Error:</span>
            <span className="ml-2">{error}</span>
          </div>
        )}
        
        <div>
          <span className="text-gray-400">Providers:</span>
          <span className="ml-2">{providers.length}</span>
        </div>
        
        {providers.length > 0 && (
          <div className="mt-2 border-t border-gray-700 pt-2">
            <span className="text-gray-400">List:</span>
            <ul className="mt-1 space-y-1">
              {providers.map((p: any) => (
                <li key={p.id} className="text-gray-300">
                  • {p.displayName} ({p.id})
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}


"use client";

import React from 'react';
import { useServiceWorkerRegistration, useCacheAdminPages } from '@/hooks/use-service-worker';
import { PWAInstallPrompt } from './pwa-install-prompt';

/**
 * PWA Provider Component
 * 
 * Initializes service worker registration and PWA features for the application.
 * Handles offline support, caching, and app installation prompts.
 * 
 * Features:
 * - Service worker registration for offline support
 * - Admin page caching for offline access
 * - PWA install prompt with beautiful UI
 */
export function PWAProvider({ children }: { children: React.ReactNode }) {
  // Register service worker
  useServiceWorkerRegistration();
  
  // Cache admin pages for offline access
  useCacheAdminPages();

  // Enable debug mode in development to always show the prompt
  // Set to false to test production behavior in dev mode
  const isDebugMode = false; // Change to true to enable debug mode

  return (
    <>
      {children}
      <PWAInstallPrompt position="bottom" forceShow={isDebugMode} />
    </>
  );
}


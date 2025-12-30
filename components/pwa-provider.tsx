"use client";

import React, { useEffect } from 'react';
import { useServiceWorkerRegistration, useCacheAdminPages } from '@/hooks/use-service-worker';

/**
 * PWA Provider Component
 * 
 * Initializes service worker registration and PWA features for the application.
 * Handles offline support, caching, and app installation prompts.
 */
export function PWAProvider({ children }: { children: React.ReactNode }) {
  // Register service worker
  useServiceWorkerRegistration();
  
  // Cache admin pages for offline access
  useCacheAdminPages();

  useEffect(() => {
    // Handle PWA installation prompt
    let deferredPrompt: any;

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      deferredPrompt = e;
      console.info('PWA install prompt available');
    };

    const handleAppInstalled = () => {
      console.info('PWA installed successfully');
      deferredPrompt = null;
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  return <>{children}</>;
}


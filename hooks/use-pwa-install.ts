"use client";

import { useState, useEffect, useCallback } from 'react';

/**
 * Interface for the deferred install prompt event
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Hook to manage PWA installation prompt
 * 
 * Captures the beforeinstallprompt event and provides methods to:
 * - Show the install prompt
 * - Track installation state
 * - Handle user acceptance/dismissal
 * 
 * @returns Object containing:
 *   - canInstall: boolean indicating if install prompt is available
 *   - isInstalled: boolean indicating if app is already installed
 *   - isLoading: boolean indicating if checking installation state
 *   - installApp: function to trigger the install prompt
 *   - dismissPrompt: function to dismiss the prompt
 */
export function usePWAInstall() {
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check if already installed
    const checkInstallation = () => {
      const isStandalone =
        (window.navigator as any).standalone === true ||
        window.matchMedia('(display-mode: standalone)').matches ||
        window.matchMedia('(display-mode: fullscreen)').matches;

      setIsInstalled(isStandalone);
      setIsLoading(false);
    };

    checkInstallation();

    // Handle beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      setDeferredPrompt(promptEvent);
      setCanInstall(true);

      if (process.env.NODE_ENV === 'development') {
        console.log('[PWA Install] beforeinstallprompt event captured');
      }
    };

    // Handle app installed event
    const handleAppInstalled = () => {
      setCanInstall(false);
      setIsInstalled(true);
      setDeferredPrompt(null);

      if (process.env.NODE_ENV === 'development') {
        console.log('[PWA Install] App installed successfully');
      }
    };

    // Listen for display mode changes
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleDisplayModeChange = () => {
      checkInstallation();
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleDisplayModeChange);
    } else {
      mediaQuery.addListener(handleDisplayModeChange);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);

      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleDisplayModeChange);
      } else {
        mediaQuery.removeListener(handleDisplayModeChange);
      }
    };
  }, []);

  /**
   * Trigger the PWA install prompt
   */
  const installApp = useCallback(async () => {
    if (!deferredPrompt) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[PWA Install] No install prompt available. In production, this prompt will only show when the browser provides the beforeinstallprompt event.');
        console.warn('[PWA Install] To test on mobile: Use Android Chrome or deploy to HTTPS server.');
      }
      return false;
    }

    try {
      // Show the install prompt
      await deferredPrompt.prompt();

      // Wait for user choice
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === 'accepted') {
        if (process.env.NODE_ENV === 'development') {
          console.log('[PWA Install] User accepted installation');
        }
        setCanInstall(false);
        setDeferredPrompt(null);
        return true;
      } else {
        if (process.env.NODE_ENV === 'development') {
          console.log('[PWA Install] User dismissed installation');
        }
        return false;
      }
    } catch (error) {
      console.error('[PWA Install] Error during installation:', error);
      return false;
    }
  }, [deferredPrompt]);

  /**
   * Dismiss the install prompt
   */
  const dismissPrompt = useCallback(() => {
    setCanInstall(false);
    setDeferredPrompt(null);
  }, []);

  return {
    canInstall,
    isInstalled,
    isLoading,
    installApp,
    dismissPrompt,
    hasPrompt: !!deferredPrompt, // New: indicates if browser prompt is available
  };
}


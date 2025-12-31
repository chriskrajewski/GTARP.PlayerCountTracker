"use client";

import { useState, useEffect } from 'react';

/**
 * Hook to detect if the app is running in PWA standalone mode
 * 
 * This hook checks multiple conditions to determine if the app
 * is installed and running as a Progressive Web App:
 * 
 * 1. CSS media query: display-mode: standalone
 * 2. iOS Safari: navigator.standalone property
 * 3. Android TWA: document.referrer includes 'android-app://'
 * 
 * @returns Object containing isPWA boolean and loading state
 */
export function usePWAStandalone() {
  const [isPWA, setIsPWA] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkPWAStatus = () => {
      // Check CSS media query for standalone display mode
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      
      // Check iOS Safari standalone mode (home screen app)
      const isIOSStandalone = (window.navigator as any).standalone === true;
      
      // Check if running as Android TWA (Trusted Web Activity)
      const isAndroidTWA = document.referrer.includes('android-app://');
      
      // Also check for fullscreen mode which some PWAs use
      const isFullscreen = window.matchMedia('(display-mode: fullscreen)').matches;
      
      // Check for minimal-ui mode (fallback for some devices)
      const isMinimalUI = window.matchMedia('(display-mode: minimal-ui)').matches;
      
      const isPWAMode = isStandalone || isIOSStandalone || isAndroidTWA || isFullscreen || isMinimalUI;
      
      setIsPWA(isPWAMode);
      setIsLoading(false);
      
      // Debug logging in development
      if (process.env.NODE_ENV === 'development') {
        console.log('[PWA Detection]', {
          isStandalone,
          isIOSStandalone,
          isAndroidTWA,
          isFullscreen,
          isMinimalUI,
          isPWAMode
        });
      }
    };

    // Initial check
    checkPWAStatus();

    // Listen for display mode changes (e.g., when installed)
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleChange = () => checkPWAStatus();
    
    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
    } else {
      // Fallback for older browsers
      mediaQuery.addListener(handleChange);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleChange);
      } else {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, []);

  return { isPWA, isLoading };
}

/**
 * Hook to detect if the device is mobile
 * Useful for determining dock visibility even outside PWA mode
 */
export function useIsMobileDevice() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 640 || 
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      setIsMobile(mobile);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
}


"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePWAInstall } from '@/hooks/use-pwa-install';

/**
 * PWA Install Prompt Component
 * 
 * Displays a beautiful, non-intrusive install prompt for PWA installation.
 * Features:
 * - Smooth animations and transitions
 * - Dismissible with X button
 * - Auto-hides when app is installed
 * - Responsive design for mobile and desktop
 * - Glassmorphism styling
 * - Accessible button interactions
 */
interface PWAInstallPromptProps {
  /**
   * Position of the prompt on screen
   * @default 'bottom'
   */
  position?: 'top' | 'bottom';

  /**
   * Custom className for the container
   */
  className?: string;

  /**
   * Callback when install is clicked
   */
  onInstallClick?: () => void;

  /**
   * Callback when prompt is dismissed
   */
  onDismiss?: () => void;

  /**
   * Whether to show the prompt (useful for manual control)
   */
  show?: boolean;

  /**
   * Force show for debugging (ignores all conditions)
   */
  forceShow?: boolean;
}

export const PWAInstallPrompt = React.memo(function PWAInstallPrompt({
  position = 'bottom',
  className,
  onInstallClick,
  onDismiss,
  show,
  forceShow = false,
}: PWAInstallPromptProps) {
  const { canInstall, isInstalled, isLoading, installApp, dismissPrompt, hasPrompt } = usePWAInstall();
  const [isVisible, setIsVisible] = useState(false);
  const [hasUserDismissed, setHasUserDismissed] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  // Check localStorage for user dismissal preference
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed === 'true') {
      setHasUserDismissed(true);
    }
  }, []);

  // Determine visibility
  useEffect(() => {
    if (forceShow) {
      setIsVisible(true);
      return;
    }

    const shouldShow = show !== undefined ? show : (canInstall && !isInstalled && !hasUserDismissed && !isLoading);
    setIsVisible(shouldShow);
  }, [canInstall, isInstalled, hasUserDismissed, isLoading, show, forceShow]);

  const handleInstall = async () => {
    onInstallClick?.();
    
    // If in debug mode without real prompt, show instructions
    if (forceShow && !hasPrompt) {
      setShowInstructions(true);
      return;
    }
    
    const success = await installApp();
    if (!success && forceShow) {
      setShowInstructions(true);
    }
  };

  const handleDismiss = () => {
    setHasUserDismissed(true);
    if (!forceShow) {
      localStorage.setItem('pwa-install-dismissed', 'true');
    }
    dismissPrompt();
    setShowInstructions(false);
    onDismiss?.();
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className={cn(
            "fixed left-4 right-4 z-[9998] pointer-events-auto",
            position === 'bottom' ? 'bottom-20 md:bottom-6' : 'top-4 md:top-6',
            className
          )}
          initial={{ opacity: 0, y: position === 'bottom' ? 20 : -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: position === 'bottom' ? 20 : -20 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
          {/* Container with glassmorphism effect */}
          <div
            className="relative rounded-2xl overflow-hidden shadow-2xl"
            style={{
              background: 'linear-gradient(135deg, rgba(18, 18, 22, 0.95) 0%, rgba(8, 8, 10, 0.98) 100%)',
              backdropFilter: 'blur(20px) saturate(180%)',
              WebkitBackdropFilter: 'blur(20px) saturate(180%)',
              border: '1px solid rgba(0, 217, 255, 0.2)',
            }}
          >
            {/* Gradient border effect */}
            <div
              className="absolute inset-0 rounded-2xl pointer-events-none"
              style={{
                background: 'linear-gradient(135deg, rgba(0, 217, 255, 0.1) 0%, rgba(20, 184, 166, 0.1) 100%)',
                padding: '1px',
              }}
            />

            {/* Content */}
            <div className="relative p-4 md:p-5">
              <div className="flex items-start gap-3 md:gap-4">
                {/* Icon */}
                <motion.div
                  className="flex-shrink-0 mt-1"
                  animate={{
                    y: [0, -4, 0],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                >
                  <div
                    className="p-2.5 rounded-lg"
                    style={{
                      background: 'linear-gradient(135deg, rgba(0, 217, 255, 0.2) 0%, rgba(20, 184, 166, 0.2) 100%)',
                    }}
                  >
                    <Download className="w-5 h-5 md:w-6 md:h-6 text-cyan-400" />
                  </div>
                </motion.div>

                {/* Text content */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm md:text-base font-semibold text-white mb-1">
                    {showInstructions ? 'How to Install' : 'Install RPStats.com'}
                  </h3>
                  {showInstructions ? (
                    <div className="text-xs md:text-sm text-gray-300 leading-relaxed space-y-2">
                      {/iPad|iPhone|iPod/.test(navigator.userAgent) ? (
                        <>
                          <p className="font-medium">On iOS Safari:</p>
                          <ol className="list-decimal list-inside space-y-1 text-gray-400">
                            <li>Tap the Share button (bottom center)</li>
                            <li>Scroll and tap "Add to Home Screen"</li>
                            <li>Tap "Add" to confirm</li>
                          </ol>
                        </>
                      ) : /Android/.test(navigator.userAgent) ? (
                        <>
                          <p className="font-medium">On Android:</p>
                          <ol className="list-decimal list-inside space-y-1 text-gray-400">
                            <li>Tap the menu (⋮) in your browser</li>
                            <li>Select "Add to Home screen"</li>
                            <li>Tap "Add" to confirm</li>
                          </ol>
                        </>
                      ) : (
                        <>
                          <p className="font-medium">On Desktop:</p>
                          <ol className="list-decimal list-inside space-y-1 text-gray-400">
                            <li>Look for the install icon in the address bar</li>
                            <li>Click it and follow the prompts</li>
                          </ol>
                          {forceShow && (
                            <p className="text-xs text-yellow-400 mt-2">
                              Debug mode: Deploy to HTTPS or use mobile Chrome to test real installation.
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs md:text-sm text-gray-400 leading-relaxed">
                      Get quick access to player counts and streams. Install as an app on your device.
                    </p>
                  )}
                </div>

                {/* Close button */}
                <button
                  onClick={handleDismiss}
                  className="flex-shrink-0 p-1.5 rounded-lg hover:bg-white/10 transition-colors duration-200 text-gray-400 hover:text-white"
                  aria-label="Dismiss install prompt"
                >
                  <X className="w-4 h-4 md:w-5 md:h-5" />
                </button>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 mt-4">
                {!showInstructions ? (
                  <>
                    <motion.button
                      onClick={handleInstall}
                      className="flex-1 px-4 py-2.5 rounded-lg font-medium text-sm md:text-base transition-all duration-200 flex items-center justify-center gap-2"
                      style={{
                        background: 'linear-gradient(135deg, #00D9FF 0%, #14B8A6 100%)',
                        color: '#000',
                      }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Download className="w-4 h-4" />
                      <span>Install</span>
                    </motion.button>

                    <motion.button
                      onClick={handleDismiss}
                      className="px-4 py-2.5 rounded-lg font-medium text-sm md:text-base text-gray-300 hover:text-white hover:bg-white/10 transition-colors duration-200"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      Later
                    </motion.button>
                  </>
                ) : (
                  <motion.button
                    onClick={handleDismiss}
                    className="flex-1 px-4 py-2.5 rounded-lg font-medium text-sm md:text-base transition-all duration-200"
                    style={{
                      background: 'linear-gradient(135deg, #00D9FF 0%, #14B8A6 100%)',
                      color: '#000',
                    }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Got it
                  </motion.button>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

PWAInstallPrompt.displayName = 'PWAInstallPrompt';

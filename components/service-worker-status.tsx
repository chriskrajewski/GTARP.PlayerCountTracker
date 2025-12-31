"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Wifi, WifiOff, Cloud, CloudOff, RefreshCw, Check, AlertTriangle } from 'lucide-react';
import { useOnlineStatus, useIsPWA } from '@/hooks/use-service-worker';

type ServiceWorkerState = 'installing' | 'installed' | 'activating' | 'activated' | 'redundant' | 'unsupported' | 'waiting';

interface ServiceWorkerStatusProps {
  /** Position of the indicator */
  position?: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
  /** Show expanded details by default */
  expandedByDefault?: boolean;
  /** Compact mode - only show icon */
  compact?: boolean;
}

/**
 * Service Worker Status Indicator
 * 
 * Shows a subtle indicator for:
 * - Online/offline status
 * - Service worker registration state
 * - Cache status
 * - PWA mode detection
 */
export function ServiceWorkerStatus({ 
  position = 'bottom-left',
  expandedByDefault = false,
  compact = false
}: ServiceWorkerStatusProps) {
  const [mounted, setMounted] = useState(false);
  const [swState, setSwState] = useState<ServiceWorkerState>('unsupported');
  const [isExpanded, setIsExpanded] = useState(expandedByDefault);
  const [lastCacheUpdate, setLastCacheUpdate] = useState<Date | null>(null);
  const [cacheSize, setCacheSize] = useState<string | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  
  const isOnline = useOnlineStatus();
  const isPWA = useIsPWA();

  // Ensure component is mounted before rendering
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      setSwState('unsupported');
      return;
    }

    const checkServiceWorker = async () => {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        
        if (!registration) {
          setSwState('unsupported');
          return;
        }

        if (registration.installing) {
          setSwState('installing');
        } else if (registration.waiting) {
          setSwState('waiting');
          setUpdateAvailable(true);
        } else if (registration.active) {
          setSwState('activated');
        }

        // Listen for state changes
        const handleStateChange = () => {
          if (registration.installing) {
            setSwState('installing');
          } else if (registration.waiting) {
            setSwState('waiting');
            setUpdateAvailable(true);
          } else if (registration.active) {
            setSwState('activated');
          }
        };

        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', handleStateChange);
          }
        });

        // Get cache size estimate
        if ('storage' in navigator && 'estimate' in navigator.storage) {
          const estimate = await navigator.storage.estimate();
          if (estimate.usage) {
            setCacheSize(formatBytes(estimate.usage));
          }
        }

        // Set last cache update time
        setLastCacheUpdate(new Date());
      } catch (error) {
        console.debug('Service worker check failed:', error);
        setSwState('unsupported');
      }
    };

    checkServiceWorker();

    // Listen for online/offline events to update cache time
    const handleOnline = () => {
      setLastCacheUpdate(new Date());
    };

    window.addEventListener('online', handleOnline);

    // Listen for SW update available
    const handleUpdateAvailable = () => {
      setUpdateAvailable(true);
      setSwState('waiting');
    };

    window.addEventListener('sw-update-available', handleUpdateAvailable);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('sw-update-available', handleUpdateAvailable);
    };
  }, []);

  const handleUpdate = () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then(registration => {
        if (registration?.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          window.location.reload();
        }
      });
    }
  };

  const getStatusIcon = () => {
    if (!isOnline) {
      return <WifiOff className="h-3.5 w-3.5" />;
    }
    if (updateAvailable) {
      return <RefreshCw className="h-3.5 w-3.5" />;
    }
    if (swState === 'activated') {
      return <Check className="h-3.5 w-3.5" />;
    }
    if (swState === 'installing' || swState === 'activating') {
      return <RefreshCw className="h-3.5 w-3.5 animate-spin" />;
    }
    if (swState === 'unsupported') {
      return <AlertTriangle className="h-3.5 w-3.5" />;
    }
    return <Wifi className="h-3.5 w-3.5" />;
  };

  const getStatusColor = () => {
    if (!isOnline) return 'text-amber-400';
    if (updateAvailable) return 'text-cyan-400';
    if (swState === 'activated') return 'text-emerald-400';
    if (swState === 'installing' || swState === 'activating') return 'text-cyan-400';
    if (swState === 'unsupported') return 'text-gray-400';
    return 'text-emerald-400';
  };

  const getStatusText = () => {
    if (!isOnline) return 'Offline';
    if (updateAvailable) return 'Update Ready';
    if (swState === 'activated') return 'Online';
    if (swState === 'installing') return 'Installing...';
    if (swState === 'activating') return 'Activating...';
    if (swState === 'unsupported') return 'No SW';
    return 'Online';
  };

  const getBgColor = () => {
    if (!isOnline) return 'rgba(251, 191, 36, 0.1)';
    if (updateAvailable) return 'rgba(0, 217, 255, 0.1)';
    return 'rgba(16, 185, 129, 0.1)';
  };

  const getBorderColor = () => {
    if (!isOnline) return 'rgba(251, 191, 36, 0.3)';
    if (updateAvailable) return 'rgba(0, 217, 255, 0.3)';
    return 'rgba(16, 185, 129, 0.2)';
  };

  const positionClasses = {
    'bottom-left': 'bottom-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'top-left': 'top-20 left-4',
    'top-right': 'top-20 right-4',
  };

  // Don't render in compact mode if everything is fine
  if (compact && isOnline && swState === 'activated' && !updateAvailable) {
    return null;
  }

  // Don't render until mounted to avoid hydration issues
  if (!mounted) {
    return null;
  }

  return (
    <div className={`fixed ${positionClasses[position]} z-50`}>
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      >
        <motion.button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300 backdrop-blur-md"
          style={{
            background: getBgColor(),
            border: `1px solid ${getBorderColor()}`,
          }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <motion.span 
            className={getStatusColor()}
            animate={!isOnline ? { opacity: [1, 0.5, 1] } : {}}
            transition={{ duration: 1.5, repeat: !isOnline ? Infinity : 0 }}
          >
            {getStatusIcon()}
          </motion.span>
          
          {!compact && (
            <span className={`${getStatusColor()} whitespace-nowrap`}>
              {getStatusText()}
            </span>
          )}
          
          {isPWA && !compact && (
            <span className="text-gray-500 text-[10px] px-1.5 py-0.5 rounded bg-gray-800/50">
              PWA
            </span>
          )}
        </motion.button>

        {/* Expanded Details Panel */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="absolute bottom-full mb-2 left-0 min-w-[200px] rounded-lg p-3 backdrop-blur-xl"
              style={{
                background: 'linear-gradient(135deg, rgba(14, 14, 16, 0.95) 0%, rgba(10, 10, 12, 0.95) 100%)',
                border: '1px solid rgba(0, 217, 255, 0.15)',
                boxShadow: '0 10px 40px rgba(0, 0, 0, 0.4)',
              }}
            >
              <div className="space-y-2.5">
                {/* Connection Status */}
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-xs">Connection</span>
                  <div className="flex items-center gap-1.5">
                    {isOnline ? (
                      <>
                        <Wifi className="h-3 w-3 text-emerald-400" />
                        <span className="text-emerald-400 text-xs">Online</span>
                      </>
                    ) : (
                      <>
                        <WifiOff className="h-3 w-3 text-amber-400" />
                        <span className="text-amber-400 text-xs">Offline</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Service Worker Status */}
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-xs">Service Worker</span>
                  <span className={`text-xs ${
                    swState === 'activated' ? 'text-emerald-400' : 
                    swState === 'unsupported' ? 'text-gray-500' : 
                    'text-cyan-400'
                  }`}>
                    {swState === 'activated' ? 'Active' :
                     swState === 'installing' ? 'Installing...' :
                     swState === 'waiting' ? 'Update Ready' :
                     swState === 'unsupported' ? 'Not Available' :
                     'Unknown'}
                  </span>
                </div>

                {/* Cache Status */}
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-xs">Cache</span>
                  <div className="flex items-center gap-1.5">
                    {isOnline ? (
                      <Cloud className="h-3 w-3 text-cyan-400/60" />
                    ) : (
                      <CloudOff className="h-3 w-3 text-amber-400/60" />
                    )}
                    <span className="text-gray-300 text-xs">
                      {cacheSize || 'Unknown'}
                    </span>
                  </div>
                </div>

                {/* PWA Mode */}
                {isPWA && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-xs">Mode</span>
                    <span className="text-cyan-400 text-xs">Standalone App</span>
                  </div>
                )}

                {/* Offline Message */}
                {!isOnline && (
                  <div className="pt-2 border-t border-gray-700/50">
                    <p className="text-amber-400/80 text-[10px] leading-relaxed">
                      You're viewing cached content. Some features may be limited until you're back online.
                    </p>
                  </div>
                )}

                {/* Update Button */}
                {updateAvailable && (
                  <div className="pt-2 border-t border-gray-700/50">
                    <button
                      onClick={handleUpdate}
                      className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all"
                      style={{
                        background: 'linear-gradient(135deg, rgba(0, 217, 255, 0.2) 0%, rgba(20, 184, 166, 0.2) 100%)',
                        border: '1px solid rgba(0, 217, 255, 0.3)',
                      }}
                    >
                      <RefreshCw className="h-3 w-3 text-cyan-400" />
                      <span className="text-cyan-400">Update Now</span>
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Inline Service Worker Status (for header integration)
 * A more compact version that can be placed in the header
 */
export function InlineServiceWorkerStatus() {
  const [swState, setSwState] = useState<ServiceWorkerState>('unsupported');
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const isOnline = useOnlineStatus();

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    const checkServiceWorker = async () => {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration?.active) {
          setSwState('activated');
        }
        if (registration?.waiting) {
          setUpdateAvailable(true);
        }
      } catch {
        // Ignore errors
      }
    };

    checkServiceWorker();

    const handleUpdateAvailable = () => setUpdateAvailable(true);
    window.addEventListener('sw-update-available', handleUpdateAvailable);
    return () => window.removeEventListener('sw-update-available', handleUpdateAvailable);
  }, []);

  // Only show if offline or update available
  if (isOnline && !updateAvailable) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs"
      style={{
        background: !isOnline ? 'rgba(251, 191, 36, 0.1)' : 'rgba(0, 217, 255, 0.1)',
        border: `1px solid ${!isOnline ? 'rgba(251, 191, 36, 0.3)' : 'rgba(0, 217, 255, 0.3)'}`,
      }}
    >
      {!isOnline ? (
        <>
          <WifiOff className="h-3 w-3 text-amber-400" />
          <span className="text-amber-400">Offline</span>
        </>
      ) : updateAvailable ? (
        <>
          <RefreshCw className="h-3 w-3 text-cyan-400" />
          <span className="text-cyan-400">Update</span>
        </>
      ) : null}
    </motion.div>
  );
}


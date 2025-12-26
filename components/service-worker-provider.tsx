'use client';

import { useEffect, useState } from 'react';
import { registerServiceWorker, onServiceWorkerMessage } from '@/lib/service-worker';
import { logger } from '@/lib/logger';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';

/**
 * Service Worker Provider Component
 * 
 * Registers the service worker and handles lifecycle events.
 * Notifies users when updates are available.
 */
export function ServiceWorkerProvider() {
  const [isRegistered, setIsRegistered] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const { toast } = useToast();

  // Ensure component only renders on client
  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;

    const initServiceWorker = async () => {
      try {
        const registration = await registerServiceWorker({
          enabled: true,
        });

        if (registration) {
          setIsRegistered(true);
          logger.info('Service Worker initialized');
        }
      } catch (error) {
        logger.error('Failed to initialize Service Worker', error);
      }
    };

    // Only register in browser environment
    if (typeof window !== 'undefined') {
      initServiceWorker();
    }
  }, [isMounted]);

  useEffect(() => {
    if (!isRegistered || !isMounted) return;

    // Listen for update available event
    const handleUpdateAvailable = (event: Event) => {
      const customEvent = event as CustomEvent;
      logger.info('Service Worker update available');

      toast({
        title: 'Update Available',
        description: 'A new version of the app is available. Refresh to update.',
        action: (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              window.location.reload();
            }}
          >
            Refresh
          </Button>
        ),
      });
    };

    window.addEventListener('sw-update-available', handleUpdateAvailable);

    // Listen for messages from service worker
    const unsubscribe = onServiceWorkerMessage((event) => {
      logger.debug('Message from Service Worker', {
        type: event.data?.type,
      });
    });

    return () => {
      window.removeEventListener('sw-update-available', handleUpdateAvailable);
      unsubscribe();
    };
  }, [isRegistered, isMounted, toast]);

  // Don't render anything - this is just for side effects
  return null;
}

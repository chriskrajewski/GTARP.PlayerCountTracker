'use client'

import { BotIdClient } from 'botid/client'
import { useEffect, useState } from 'react'
import { registerServiceWorker, onServiceWorkerMessage } from '@/lib/service-worker'
import { logger } from '@/lib/logger'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'

/**
 * Combined BotID and Service Worker Provider Component
 * 
 * Initializes both:
 * 1. Vercel's BotID protection on the client side for bot abuse prevention
 * 2. Service Worker for offline support and performance optimization
 * 
 * BotID runs JavaScript challenges to verify that requests come from real users,
 * protecting APIs, forms, and sensitive endpoints from automated bot abuse.
 * 
 * Service Worker enables offline functionality and faster repeat visits through caching.
 * 
 * This component should be mounted in the root layout to ensure both protections
 * are active across the entire application.
 * 
 * @see https://vercel.com/docs/botid/get-started
 */
export function BotIDProvider() {
  const [isRegistered, setIsRegistered] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const { toast } = useToast()

  // Ensure component only renders on client
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Initialize Service Worker
  useEffect(() => {
    if (!isMounted) return

    const initServiceWorker = async () => {
      try {
        const registration = await registerServiceWorker({
          enabled: true,
        })

        if (registration) {
          setIsRegistered(true)
          logger.info('Service Worker initialized')
        }
      } catch (error) {
        logger.error('Failed to initialize Service Worker', error)
      }
    }

    // Only register in browser environment
    if (typeof window !== 'undefined') {
      initServiceWorker()
    }
  }, [isMounted])

  // Listen for Service Worker updates
  useEffect(() => {
    if (!isRegistered || !isMounted) return

    const handleUpdateAvailable = (event: Event) => {
      logger.info('Service Worker update available')

      toast({
        title: 'Update Available',
        description: 'A new version of the app is available. Refresh to update.',
        action: (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              window.location.reload()
            }}
          >
            Refresh
          </Button>
        ),
      })
    }

    window.addEventListener('sw-update-available', handleUpdateAvailable)

    // Listen for messages from service worker
    const unsubscribe = onServiceWorkerMessage((event) => {
      logger.debug('Message from Service Worker', {
        type: event.data?.type,
      })
    })

    return () => {
      window.removeEventListener('sw-update-available', handleUpdateAvailable)
      unsubscribe()
    }
  }, [isRegistered, isMounted, toast])

  // Define which routes should be protected by BotID
  const protectedRoutes = [
    { path: '/api/feedback', method: 'POST' },
    { path: '/api/admin/*', method: '*' },
    { path: '/api/notification-banners/dismiss', method: 'POST' },
  ]

  return <BotIdClient protect={protectedRoutes} />
}

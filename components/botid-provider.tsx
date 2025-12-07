'use client'

import { BotIdClient } from 'botid/client'

/**
 * BotID Provider Component
 * 
 * Initializes Vercel's BotID protection on the client side.
 * BotID runs JavaScript challenges to verify that requests come from real users,
 * protecting APIs, forms, and sensitive endpoints from automated bot abuse.
 * 
 * This component should be mounted in the root layout to ensure BotID protection
 * is active across the entire application.
 * 
 * @see https://vercel.com/docs/botid/get-started
 */
export function BotIDProvider() {
  // Define which routes should be protected by BotID
  const protectedRoutes = [
    { path: '/api/feedback', method: 'POST' },
    { path: '/api/admin/*', method: '*' },
    { path: '/api/notification-banners/dismiss', method: 'POST' },
  ]

  return <BotIdClient protect={protectedRoutes} />
}

import { checkBotId } from 'botid/server'

/**
 * BotID Verification Result
 * 
 * Result from the botid/server checkBotId function
 */
export interface BotIDResult {
  isHuman: boolean
  isBot: boolean
  isVerifiedBot: boolean
  verifiedBotName?: string
  verifiedBotCategory?: string
  bypassed: boolean
  classificationReason?: string
}

/**
 * Verifies if a request is from a real user using BotID
 * 
 * This function uses the official botid/server package to verify requests.
 * It checks the BotID headers added by the client-side script and performs
 * server-side verification.
 * 
 * @param options - Configuration options for BotID verification
 * @returns BotIDResult with classification details
 * 
 * @example
 * ```typescript
 * export async function POST(request: Request) {
 *   const result = await verifyBotID()
 *   
 *   if (result.isBot) {
 *     return new Response('Access denied', { status: 403 })
 *   }
 *   
 *   // Process legitimate request
 *   return new Response('Success')
 * }
 * ```
 * 
 * @see https://vercel.com/docs/botid/get-started
 */
export async function verifyBotID(options?: {
  checkLevel?: 'deepAnalysis' | 'basic'
  isDevelopment?: boolean
}): Promise<BotIDResult> {
  try {
    const result = await checkBotId({
      advancedOptions: {
        checkLevel: options?.checkLevel || 'basic',
      },
      developmentOptions: {
        isDevelopment: options?.isDevelopment,
      },
    })

    return {
      isHuman: result.isHuman,
      isBot: result.isBot,
      isVerifiedBot: result.isVerifiedBot,
      verifiedBotName: 'verifiedBotName' in result ? result.verifiedBotName : undefined,
      verifiedBotCategory: 'verifiedBotCategory' in result ? result.verifiedBotCategory : undefined,
      bypassed: result.bypassed,
      classificationReason: 'classificationReason' in result ? result.classificationReason : undefined,
    }
  } catch (error) {
    console.error('[BotID] Verification error:', error)
    // In case of error, default to allowing the request but log it
    return {
      isHuman: true,
      isBot: false,
      isVerifiedBot: false,
      bypassed: false,
    }
  }
}

/**
 * Middleware helper to protect API routes with BotID
 * 
 * @param handler - The API route handler to protect
 * @param options - Configuration options for BotID verification
 * @returns Protected handler that checks BotID before executing
 * 
 * @example
 * ```typescript
 * export const POST = withBotIDProtection(async (request: Request) => {
 *   // Your API logic here
 *   return new Response('Success')
 * })
 * ```
 */
export function withBotIDProtection(
  handler: (request: Request) => Promise<Response>,
  options?: {
    checkLevel?: 'deepAnalysis' | 'basic'
    isDevelopment?: boolean
  }
) {
  return async (request: Request): Promise<Response> => {
    const result = await verifyBotID(options)

    if (result.isBot && !result.isVerifiedBot) {
      return new Response(
        JSON.stringify({
          error: 'Access denied',
          message: 'This request appears to be from an automated bot',
          code: 'BOT_DETECTED',
        }),
        {
          status: 403,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    }

    return handler(request)
  }
}

/**
 * Logs BotID verification results for monitoring and debugging
 * 
 * @param result - The BotID verification result
 * @param context - Additional context for logging (e.g., route, method)
 */
export function logBotIDVerification(
  result: BotIDResult,
  context?: Record<string, unknown>
): void {
  const logData = {
    timestamp: new Date().toISOString(),
    isHuman: result.isHuman,
    isBot: result.isBot,
    isVerifiedBot: result.isVerifiedBot,
    verifiedBotName: result.verifiedBotName,
    verifiedBotCategory: result.verifiedBotCategory,
    bypassed: result.bypassed,
    ...context,
  }

  if (result.isBot && !result.isVerifiedBot) {
    console.warn('[BotID] Potential bot detected:', logData)
  } else if (result.isVerifiedBot) {
    console.info('[BotID] Verified bot allowed:', logData)
  } else {
    console.debug('[BotID] Legitimate user verified:', logData)
  }
}

/**
 * Input Validation Middleware
 * 
 * Provides request validation using Zod schemas.
 * Ensures consistent error responses and type safety.
 * 
 * @example
 * const schema = z.object({
 *   email: z.string().email(),
 *   name: z.string().min(1),
 * });
 * 
 * export async function POST(request: Request) {
 *   const result = await validateRequest(request, schema);
 *   if (!result.success) {
 *     return result.error;
 *   }
 *   const data = result.data;
 *   // ... handle request
 * }
 */

import { NextResponse } from 'next/server';
import { z, ZodSchema, ZodError } from 'zod';
import { logger } from './logger';

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  error?: NextResponse;
  errors?: Record<string, string[]>;
}

/**
 * Validates request body against a Zod schema
 * 
 * @param request - The incoming request
 * @param schema - Zod schema to validate against
 * @param options - Additional validation options
 * @returns Validation result with data or error response
 */
export async function validateRequest<T>(
  request: Request,
  schema: ZodSchema,
  options?: {
    logErrors?: boolean;
    customErrorMessage?: string;
  }
): Promise<ValidationResult<T>> {
  try {
    const body = await request.json();
    const result = schema.safeParse(body);

    if (!result.success) {
      const errors = formatZodErrors(result.error);

      if (options?.logErrors !== false) {
        logger.warn('Request validation failed', {
          endpoint: new URL(request.url).pathname,
          errors,
        });
      }

      return {
        success: false,
        errors,
        error: NextResponse.json(
          {
            success: false,
            error: options?.customErrorMessage || 'Validation failed',
            details: errors,
          },
          { status: 400 }
        ),
      };
    }

    return {
      success: true,
      data: result.data as T,
    };
  } catch (error) {
    logger.error('Request parsing failed', error, {
      endpoint: new URL(request.url).pathname,
    });

    return {
      success: false,
      error: NextResponse.json(
        {
          success: false,
          error: 'Invalid request body',
        },
        { status: 400 }
      ),
    };
  }
}

/**
 * Validates query parameters against a Zod schema
 * 
 * @param searchParams - URLSearchParams from request
 * @param schema - Zod schema to validate against
 * @param options - Additional validation options
 * @returns Validation result with data or error response
 */
export function validateQueryParams<T>(
  searchParams: URLSearchParams,
  schema: ZodSchema,
  options?: {
    logErrors?: boolean;
    customErrorMessage?: string;
  }
): ValidationResult<T> {
  try {
    const params = Object.fromEntries(searchParams);
    const result = schema.safeParse(params);

    if (!result.success) {
      const errors = formatZodErrors(result.error);

      if (options?.logErrors !== false) {
        logger.warn('Query parameter validation failed', { errors });
      }

      return {
        success: false,
        errors,
        error: NextResponse.json(
          {
            success: false,
            error: options?.customErrorMessage || 'Validation failed',
            details: errors,
          },
          { status: 400 }
        ),
      };
    }

    return {
      success: true,
      data: result.data as T,
    };
  } catch (error) {
    logger.error('Query parameter parsing failed', error);

    return {
      success: false,
      error: NextResponse.json(
        {
          success: false,
          error: 'Invalid query parameters',
        },
        { status: 400 }
      ),
    };
  }
}

/**
 * Formats Zod validation errors into a readable object
 */
function formatZodErrors(error: ZodError): Record<string, string[]> {
  const formatted: Record<string, string[]> = {};

  error.errors.forEach((err) => {
    const path = err.path.join('.');
    if (!formatted[path]) {
      formatted[path] = [];
    }
    formatted[path].push(err.message);
  });

  return formatted;
}

/**
 * Common validation schemas for reuse
 */
export const commonSchemas = {
  /**
   * Email validation schema
   */
  email: z.string().email('Invalid email address'),

  /**
   * UUID validation schema
   */
  uuid: z.string().uuid('Invalid UUID format'),

  /**
   * Server ID validation schema
   */
  serverId: z.string().min(1, 'Server ID is required'),

  /**
   * Pagination schema
   */
  pagination: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  }),

  /**
   * Date range schema
   */
  dateRange: z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
  }),

  /**
   * Feedback submission schema
   */
  feedback: z.object({
    title: z.string().min(1, 'Title is required').max(200),
    description: z.string().min(1, 'Description is required').max(5000),
    type: z.enum(['bug', 'feature', 'feedback']),
    email: z.string().email().optional(),
    serverName: z.string().optional(),
  }),
};

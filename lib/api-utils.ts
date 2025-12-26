/**
 * API Utilities Module
 * 
 * Provides comprehensive utilities for API response handling including:
 * - Response pagination for large datasets
 * - ETag support for HTTP caching
 * - Standardized response formatting
 * - Compression-friendly response handling
 * 
 * @module lib/api-utils
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';

/**
 * Pagination parameters interface
 */
export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

/**
 * Paginated response metadata
 */
export interface PaginationMeta {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: PaginationMeta;
}

/**
 * Standard API response interface
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

/**
 * ETag configuration options
 */
export interface ETagOptions {
  weak?: boolean;
  maxAge?: number;
  staleWhileRevalidate?: number;
}

/**
 * Default pagination configuration
 */
export const DEFAULT_PAGINATION = {
  page: 1,
  limit: 20,
  maxLimit: 100,
} as const;

/**
 * Parse pagination parameters from request URL
 * 
 * @param request - Next.js request object
 * @param defaults - Default pagination values
 * @returns Parsed and validated pagination parameters
 * 
 * @example
 * const pagination = parsePaginationParams(request);
 * // { page: 1, limit: 20, offset: 0 }
 */
export function parsePaginationParams(
  request: NextRequest,
  defaults: { page?: number; limit?: number; maxLimit?: number } = {}
): PaginationParams {
  const searchParams = request.nextUrl.searchParams;
  
  const maxLimit = defaults.maxLimit ?? DEFAULT_PAGINATION.maxLimit;
  
  // Parse page number (1-indexed)
  let page = parseInt(searchParams.get('page') || String(defaults.page ?? DEFAULT_PAGINATION.page), 10);
  if (isNaN(page) || page < 1) {
    page = 1;
  }
  
  // Parse limit with max constraint
  let limit = parseInt(searchParams.get('limit') || String(defaults.limit ?? DEFAULT_PAGINATION.limit), 10);
  if (isNaN(limit) || limit < 1) {
    limit = DEFAULT_PAGINATION.limit;
  }
  limit = Math.min(limit, maxLimit);
  
  // Calculate offset (0-indexed for database queries)
  const offset = (page - 1) * limit;
  
  return { page, limit, offset };
}

/**
 * Create pagination metadata from query results
 * 
 * @param totalItems - Total number of items in the dataset
 * @param params - Current pagination parameters
 * @returns Pagination metadata object
 */
export function createPaginationMeta(
  totalItems: number,
  params: PaginationParams
): PaginationMeta {
  const totalPages = Math.ceil(totalItems / params.limit);
  
  return {
    currentPage: params.page,
    pageSize: params.limit,
    totalItems,
    totalPages,
    hasNextPage: params.page < totalPages,
    hasPreviousPage: params.page > 1,
  };
}

/**
 * Create a paginated response
 * 
 * @param data - Array of items for the current page
 * @param totalItems - Total number of items in the dataset
 * @param params - Current pagination parameters
 * @returns Formatted paginated response
 * 
 * @example
 * const response = createPaginatedResponse(items, totalCount, pagination);
 * return NextResponse.json(response);
 */
export function createPaginatedResponse<T>(
  data: T[],
  totalItems: number,
  params: PaginationParams
): PaginatedResponse<T> {
  return {
    success: true,
    data,
    pagination: createPaginationMeta(totalItems, params),
  };
}

/**
 * Generate ETag from response data
 * 
 * Creates a hash-based ETag for HTTP caching. Uses weak ETags by default
 * as they allow for semantically equivalent representations.
 * 
 * @param data - Data to generate ETag from
 * @param options - ETag generation options
 * @returns ETag string (e.g., "W/\"abc123\"" or "\"abc123\"")
 */
export function generateETag(data: unknown, options: ETagOptions = {}): string {
  const { weak = true } = options;
  
  // Create hash from stringified data
  const content = typeof data === 'string' ? data : JSON.stringify(data);
  const hash = createHash('md5').update(content).digest('hex').substring(0, 16);
  
  // Format as weak or strong ETag
  return weak ? `W/"${hash}"` : `"${hash}"`;
}

/**
 * Check if request ETag matches (for conditional GET)
 * 
 * @param request - Next.js request object
 * @param currentETag - Current resource ETag
 * @returns true if ETags match (304 Not Modified should be returned)
 */
export function checkETagMatch(request: NextRequest, currentETag: string): boolean {
  const ifNoneMatch = request.headers.get('if-none-match');
  
  if (!ifNoneMatch) {
    return false;
  }
  
  // Handle multiple ETags in If-None-Match header
  const clientETags = ifNoneMatch.split(',').map(tag => tag.trim());
  
  // Check for wildcard
  if (clientETags.includes('*')) {
    return true;
  }
  
  // Compare ETags (weak comparison for weak ETags)
  const normalizedCurrent = currentETag.replace(/^W\//, '');
  return clientETags.some(tag => {
    const normalizedClient = tag.replace(/^W\//, '');
    return normalizedClient === normalizedCurrent;
  });
}

/**
 * Create a JSON response with ETag and cache headers
 * 
 * @param data - Response data
 * @param request - Original request (for conditional GET check)
 * @param options - Response options including cache settings
 * @returns NextResponse with appropriate headers
 * 
 * @example
 * return createCachedResponse(data, request, { maxAge: 60 });
 */
export function createCachedResponse<T>(
  data: T,
  request: NextRequest,
  options: ETagOptions & { status?: number } = {}
): NextResponse {
  const { maxAge = 60, staleWhileRevalidate = 30, status = 200 } = options;
  
  const etag = generateETag(data, options);
  
  // Check for conditional GET (304 Not Modified)
  if (checkETagMatch(request, etag)) {
    return new NextResponse(null, {
      status: 304,
      headers: {
        'ETag': etag,
        'Cache-Control': `public, max-age=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`,
      },
    });
  }
  
  // Return full response with ETag
  return NextResponse.json(data, {
    status,
    headers: {
      'ETag': etag,
      'Cache-Control': `public, max-age=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`,
      'Vary': 'Accept-Encoding',
    },
  });
}

/**
 * Create a standard API response
 * 
 * @param data - Response data
 * @param options - Response options
 * @returns Formatted API response
 */
export function createApiResponse<T>(
  data: T,
  options: { success?: boolean; error?: string; details?: Record<string, unknown> } = {}
): ApiResponse<T> {
  const { success = true, error, details } = options;
  
  return {
    success,
    data: success ? data : undefined,
    error: success ? undefined : error,
    details: success ? undefined : details,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Create an error response
 * 
 * @param error - Error message
 * @param status - HTTP status code
 * @param details - Additional error details
 * @returns NextResponse with error
 */
export function createErrorResponse(
  error: string,
  status: number = 500,
  details?: Record<string, unknown>
): NextResponse {
  return NextResponse.json(
    createApiResponse(null, { success: false, error, details }),
    { status }
  );
}

/**
 * Add standard API headers to a response
 * 
 * @param response - NextResponse object
 * @param additionalHeaders - Additional headers to add
 * @returns Response with added headers
 */
export function addApiHeaders(
  response: NextResponse,
  additionalHeaders: Record<string, string> = {}
): NextResponse {
  // Standard API headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Request-Id', generateRequestId());
  
  // Add any additional headers
  Object.entries(additionalHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  
  return response;
}

/**
 * Generate a unique request ID for tracing
 * 
 * @returns Unique request identifier
 */
export function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `req_${timestamp}_${random}`;
}

/**
 * Parse and validate time range parameters
 * 
 * @param request - Next.js request object
 * @returns Validated time range or default
 */
export function parseTimeRange(request: NextRequest): { start: Date; end: Date; range: string } {
  const searchParams = request.nextUrl.searchParams;
  const range = searchParams.get('range') || '24h';
  
  const end = new Date();
  let start: Date;
  
  switch (range) {
    case '1h':
      start = new Date(end.getTime() - 60 * 60 * 1000);
      break;
    case '6h':
      start = new Date(end.getTime() - 6 * 60 * 60 * 1000);
      break;
    case '24h':
      start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
      break;
    case '7d':
      start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case '90d':
      start = new Date(end.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    case '180d':
      start = new Date(end.getTime() - 180 * 24 * 60 * 60 * 1000);
      break;
    case '365d':
      start = new Date(end.getTime() - 365 * 24 * 60 * 60 * 1000);
      break;
    default:
      // Default to 24 hours
      start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
  }
  
  return { start, end, range };
}

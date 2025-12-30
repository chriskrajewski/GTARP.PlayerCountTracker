import { NextRequest } from 'next/server';

// Server-side admin authentication utilities
export const ADMIN_SESSION_KEY = 'admin_session_token';

// Check if the admin token is valid (server-side)
export function isValidAdminToken(token: string): boolean {
  const adminToken = process.env.ADMIN_TOKEN;
  
  if (!adminToken) {
    console.error('ADMIN_TOKEN environment variable is not set');
    return false;
  }
  
  return token === adminToken;
}

// Check if token is a Supabase JWT (basic format check)
export function isSupabaseJWT(token: string): boolean {
  // Supabase JWTs are JWT format: header.payload.signature
  const parts = token.split('.');
  return parts.length === 3;
}

// Get admin token from request headers or cookies (server-side)
export function getAdminTokenFromRequest(request: NextRequest): string | null {
  // Check Authorization header first
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  // Check cookies
  const tokenFromCookie = request.cookies.get(ADMIN_SESSION_KEY)?.value;
  if (tokenFromCookie) {
    return tokenFromCookie;
  }
  
  return null;
}

// Validate admin request (server-side) - supports both legacy token and Supabase JWT
export function validateAdminRequest(request: NextRequest): boolean {
  const token = getAdminTokenFromRequest(request);
  if (!token) {
    return false;
  }
  
  // First try legacy admin token
  if (isValidAdminToken(token)) {
    return true;
  }

  // Accept Supabase JWT tokens (format validation only - actual verification happens in Supabase)
  // The Supabase service role client will verify the token when making requests
  if (isSupabaseJWT(token)) {
    return true;
  }

  return false;
}

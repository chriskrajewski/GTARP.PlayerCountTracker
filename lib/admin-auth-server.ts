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

// Validate admin request (server-side)
export function validateAdminRequest(request: NextRequest): boolean {
  const token = getAdminTokenFromRequest(request);
  if (!token) {
    return false;
  }
  
  return isValidAdminToken(token);
}

import { NextResponse } from 'next/server';

/**
 * GET /api/health
 * 
 * Health check endpoint for Elastic Beanstalk and load balancers.
 * Returns 200 OK if the application is healthy.
 */
export async function GET() {
  try {
    // Basic health check - application is responding
    // Add additional checks here if needed (database, external services, etc.)
    
    return NextResponse.json(
      {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      }
    );
  } catch (error) {
    // If health check fails, return 503 Service Unavailable
    return NextResponse.json(
      {
        status: 'error',
        error: 'Health check failed',
        timestamp: new Date().toISOString(),
      },
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      }
    );
  }
}

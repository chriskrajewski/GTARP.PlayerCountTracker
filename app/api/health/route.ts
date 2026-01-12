import { NextResponse } from 'next/server';
import { getMemoryUsageSnapshot } from '@/lib/memory-usage';

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

    const memoryUsage = getMemoryUsageSnapshot();
    if (memoryUsage) {
      console.info('[Health] Memory usage (MB):', memoryUsage);
    }
    
    return NextResponse.json(
      {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory_mb: memoryUsage,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      }
    );
  } catch (error) {
    const memoryUsage = getMemoryUsageSnapshot();
    // If health check fails, return 503 Service Unavailable
    return NextResponse.json(
      {
        status: 'error',
        error: 'Health check failed',
        timestamp: new Date().toISOString(),
        memory_mb: memoryUsage,
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

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
    const startTime = Date.now();
    
    const memoryUsage = getMemoryUsageSnapshot();
    
    // Check if memory usage is critical (>90% of max heap)
    const maxHeapMB = 3072; // Should match NODE_OPTIONS max-old-space-size
    const isMemoryCritical = memoryUsage && memoryUsage.heap_used_mb > (maxHeapMB * 0.9);
    
    if (isMemoryCritical) {
      console.warn('[Health] CRITICAL: Memory usage is high:', memoryUsage);
      // Still return 200 but log the warning
    }
    
    const responseTime = Date.now() - startTime;
    
    // Only log memory usage periodically to reduce log noise
    if (Math.random() < 0.1) { // 10% of requests
      console.info('[Health] Memory usage (MB):', memoryUsage);
    }
    
    return NextResponse.json(
      {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory_mb: memoryUsage,
        response_time_ms: responseTime,
        memory_critical: isMemoryCritical,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    );
  } catch (error) {
    console.error('[Health] Health check failed:', error);
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
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    );
  }
}

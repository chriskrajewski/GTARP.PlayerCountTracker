import { NextResponse } from 'next/server';
import { getAnonymizedCommits } from '@/lib/github';

// Maximum allowed length for commits response
const MAX_RESPONSE_SIZE = 50 * 1024; // 50KB

export async function GET() {
  try {
    // Basic check to ensure we're in a safe environment
    if (process.env.NODE_ENV === 'production' && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
      console.error('Missing environment variables in production');
      return NextResponse.json(
        { error: 'Service configuration error' },
        { status: 500 }
      );
    }
    
    const commits = await getAnonymizedCommits();
    
    // Validate the response data for safety
    if (!Array.isArray(commits)) {
      console.error('Invalid commits data format:', typeof commits);
      return NextResponse.json(
        { error: 'Invalid data format' },
        { status: 500 }
      );
    }
    
    // Safety check: limit response size
    const responseData = { commits };
    const responseSize = JSON.stringify(responseData).length;
    if (responseSize > MAX_RESPONSE_SIZE) {
      console.warn(`Response size (${responseSize} bytes) exceeds limit, truncating to first 10 commits`);
      responseData.commits = commits.slice(0, 10);
    }
    
    // Set appropriate cache controls and security headers
    const response = NextResponse.json(responseData);
    
    // Cache for 1 hour (3600 seconds)
    response.headers.set('Cache-Control', 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=7200');
    
    return response;
  } catch (error) {
    console.error('Error fetching changelog:', error);
    
    // Return a generic error message to avoid leaking sensitive information
    return NextResponse.json(
      { error: 'Failed to fetch changelog' },
      { 
        status: 500,
        headers: {
          // Don't cache errors
          'Cache-Control': 'no-store, max-age=0'
        }
      }
    );
  }
}

// Set revalidate option for Next.js data fetching mechanisms
export const revalidate = 3600; 
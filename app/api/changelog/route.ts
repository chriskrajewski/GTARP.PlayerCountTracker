import { NextResponse } from 'next/server';
import { getAnonymizedCommits } from '@/lib/github';

// Maximum allowed length for commits response
const MAX_RESPONSE_SIZE = 50 * 1024; // 50KB

export async function GET() {
  try {
    // Ensure required environment variables are set
    if (!process.env.GITHUB_TOKEN && process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Fetch recent commits from GitHub
    const commits = await getAnonymizedCommits();
    
    // Validate the response format
    if (!Array.isArray(commits)) {
      return NextResponse.json({ error: 'Invalid response format' }, { status: 500 });
    }
    
    // Check response size and truncate if necessary to avoid large payloads
    const responseSize = JSON.stringify(commits).length;
    const MAX_SIZE = 100 * 1024; // 100KB limit
    
    let responseData = commits;
    if (responseSize > MAX_SIZE) {
      // Truncate to first 10 commits if response is too large
      responseData = commits.slice(0, 10);
    }
    
    // Set appropriate cache controls and security headers
    const response = NextResponse.json(responseData);
    
    // Cache for 1 hour (3600 seconds)
    response.headers.set('Cache-Control', 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=7200');
    
    return response;
  } catch (error) {
    // Return a generic error response
    return NextResponse.json(
      { error: 'Failed to fetch changelog data' },
      { status: 500 }
    );
  }
}

// Set revalidate option for Next.js data fetching mechanisms
export const revalidate = 3600; 
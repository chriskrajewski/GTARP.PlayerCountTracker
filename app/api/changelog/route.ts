import { NextResponse } from 'next/server';
import { getAnonymizedCommits } from '@/lib/github';

export async function GET() {
  try {
    const commits = await getAnonymizedCommits();
    return NextResponse.json({ commits });
  } catch (error) {
    console.error('Error fetching changelog:', error);
    return NextResponse.json(
      { error: 'Failed to fetch changelog' },
      { status: 500 }
    );
  }
}

// Set cache control to revalidate every hour
export const revalidate = 3600; 
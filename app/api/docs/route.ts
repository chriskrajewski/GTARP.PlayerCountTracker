import { NextResponse } from 'next/server';
import { apiDocs, registerApiEndpoints } from '@/lib/api-docs';

/**
 * GET /api/docs
 * 
 * Returns OpenAPI specification for the API
 */
export async function GET(request: Request) {
  try {
    // Register all endpoints on first request
    registerApiEndpoints();

    const url = new URL(request.url);
    const format = url.searchParams.get('format') || 'json';

    if (format === 'html') {
      return new NextResponse(apiDocs.generateHtmlDocs(), {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    // Default to JSON
    return NextResponse.json(apiDocs.generateOpenAPISpec());
  } catch (error) {
    console.error('Error generating API documentation:', error);
    return NextResponse.json(
      { error: 'Failed to generate documentation' },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import { Octokit } from 'octokit';
import { validateRequest } from '@/lib/validation';
import { commonSchemas } from '@/lib/validation';
import { deduplicateRequest } from '@/lib/request-deduplication';
import { logger } from '@/lib/logger';

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
  const endpoint = '/api/feedback';

  try {
    const data = await request.json();

    // Validate input using Zod schema
    const validationResult = commonSchemas.feedback.safeParse(data);
    if (!validationResult.success) {
      const errors = validationResult.error.errors.reduce((acc: Record<string, string[]>, err) => {
        const path = err.path.join('.');
        if (!acc[path]) acc[path] = [];
        acc[path].push(err.message);
        return acc;
      }, {});
      
      logger.warn('Feedback validation failed', { ip, endpoint, errors });
      return NextResponse.json(
        { error: 'Invalid input', details: errors },
        { status: 400 }
      );
    }

    const validatedData = validationResult.data;

    // Get environment variables
    const githubToken = process.env.GITHUB_ACCESS_TOKEN;
    const githubRepo = process.env.GITHUB_REPO || 'GTARP.PlayerCountTracker';
    const githubOwner = process.env.GITHUB_OWNER;

    // Validate environment variables
    if (!githubToken || !githubOwner) {
      logger.error('GitHub configuration is incomplete', undefined, { ip, endpoint, status: 500 });
      return NextResponse.json(
        { error: 'GitHub configuration is incomplete' },
        { status: 500 }
      );
    }

    // Deduplicate identical feedback submissions
    const deduplicationKey = `feedback-${validatedData.title}-${validatedData.type}`;
    const response = await deduplicateRequest(
      deduplicationKey,
      async () => {
        // Initialize GitHub client
        const octokit = new Octokit({
          auth: githubToken
        });

        // Prepare labels based on feedback type
        const labels = [validatedData.type];

        // Create issue body with structured content
        const body = `
### Feedback
${validatedData.description}

${validatedData.email ? `### Contact\n${validatedData.email}` : ''}
${validatedData.serverName ? `### Server\n${validatedData.serverName}` : ''}

### Source
Submitted via website feedback form (mobile)
        `.trim();

        // Create the issue
        const githubResponse = await octokit.rest.issues.create({
          owner: githubOwner,
          repo: githubRepo,
          title: validatedData.title,
          body: body,
          labels: labels
        });

        logger.info('Feedback submitted successfully', {
          ip,
          endpoint,
          responseStatus: 200,
          issueNumber: githubResponse.data.number,
          issueUrl: githubResponse.data.html_url
        });

        return {
          success: true,
          issueNumber: githubResponse.data.number,
          issueUrl: githubResponse.data.html_url
        };
      },
      5000 // Deduplicate for 5 seconds
    );

    return NextResponse.json(response);

  } catch (error) {
    logger.error('Error creating GitHub issue', error, { ip, endpoint, status: 500 });
    return NextResponse.json(
      { error: 'Failed to submit feedback' },
      { status: 500 }
    );
  }
}
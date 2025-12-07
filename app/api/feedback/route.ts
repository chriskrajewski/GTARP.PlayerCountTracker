import { NextResponse } from 'next/server';
import { Octokit } from 'octokit';
import { verifyBotID, logBotIDVerification } from '@/lib/botid';

/**
 * Feedback submission interface
 */
interface FeedbackRequest {
  title: string;
  description: string;
  type: 'bug' | 'feature' | 'feedback';
  email?: string;
  serverName?: string;
}

/**
 * POST /api/feedback
 * 
 * Submits user feedback as a GitHub issue.
 * Protected with BotID to prevent automated spam submissions.
 * 
 * @param request - The incoming request
 * @returns JSON response with issue details or error
 */
export async function POST(request: Request) {
  try {
    // Verify request is from a real user using BotID
    const botidResult = await verifyBotID();
    logBotIDVerification(botidResult, { route: '/api/feedback', method: 'POST' });

    // Reject if detected as bot (but allow verified bots if needed)
    if (botidResult.isBot && !botidResult.isVerifiedBot) {
      return NextResponse.json(
        { 
          error: 'Access denied',
          message: 'This request appears to be from an automated bot',
          code: 'BOT_DETECTED'
        },
        { status: 403 }
      );
    }

    // Get environment variables
    const githubToken = process.env.GITHUB_ACCESS_TOKEN;
    const githubRepo = process.env.GITHUB_REPO || 'GTARP.PlayerCountTracker';
    const githubOwner = process.env.GITHUB_OWNER;
    
    // Validate environment variables
    if (!githubToken || !githubOwner) {
      return NextResponse.json(
        { error: 'GitHub configuration is incomplete' },
        { status: 500 }
      );
    }
    
    // Parse request body
    const data: FeedbackRequest = await request.json();
    
    // Validate required fields
    if (!data.title || !data.description) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Initialize GitHub client
    const octokit = new Octokit({
      auth: githubToken
    });
    
    // Prepare labels based on feedback type
    const labels = [data.type];
    
    // Create issue body with structured content
    const body = `
### Feedback
${data.description}

${data.email ? `### Contact\n${data.email}` : ''}
${data.serverName ? `### Server\n${data.serverName}` : ''}

### Source
Submitted via website feedback form (mobile)
    `.trim();
    
    // Create the issue
    const response = await octokit.rest.issues.create({
      owner: githubOwner,
      repo: githubRepo,
      title: data.title,
      body: body,
      labels: labels
    });
    
    return NextResponse.json({
      success: true,
      issueNumber: response.data.number,
      issueUrl: response.data.html_url
    });
    
  } catch (error) {
    console.error('Error creating GitHub issue:', error);
    return NextResponse.json(
      { error: 'Failed to submit feedback' },
      { status: 500 }
    );
  }
}
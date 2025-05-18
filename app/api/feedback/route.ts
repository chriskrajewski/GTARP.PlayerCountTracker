import { NextResponse } from 'next/server';
import { Octokit } from 'octokit';

// Interface for the feedback submission
interface FeedbackRequest {
  title: string;
  description: string;
  type: 'bug' | 'feature' | 'feedback';
  email?: string;
  serverName?: string;
}

export async function POST(request: Request) {
  try {
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
    if (!data.title || !data.description || !data.type) {
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
Submitted via website feedback form
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
    // Silent error in production
    return NextResponse.json({ error: 'Failed to submit feedback' }, { status: 500 });
  }
} 
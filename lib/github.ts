// Define CommitInfo interface directly in this file
interface CommitInfo {
  id: string;
  message: string;
  date: string;
  url: string;
  author: {
    name: string;
    avatar: string;
    url: string;
  };
}

// Utility function to sanitize commit data
function sanitizeCommitData(commit: any): CommitInfo {
  try {
    return {
      id: commit.sha || 'unknown',
      message: commit.commit?.message || 'No message provided',
      date: commit.commit?.author?.date || new Date().toISOString(),
      url: commit.html_url || '#',
      author: {
        name: commit.commit?.author?.name || 'Unknown',
        avatar: commit.author?.avatar_url || '',
        url: commit.author?.html_url || '#'
      }
    };
  } catch (error) {
    // Silent error in production
    return {
      id: 'error',
      message: 'Error parsing commit data',
      date: new Date().toISOString(),
      url: '#',
      author: {
        name: 'Unknown',
        avatar: '',
        url: '#'
      }
    };
  }
}

// Main function to fetch and anonymize commits
export async function getAnonymizedCommits(maxRetries = 3): Promise<CommitInfo[]> {
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const REPO = process.env.GITHUB_REPO || 'GTARP.PlayerCountTracker';
  const OWNER = process.env.GITHUB_OWNER || 'chriskrajewski';
  const CACHE_TIME = 3600; // 1 hour cache
  
  // Check if cached data exists and is still valid
  if (typeof window !== 'undefined' && window.localStorage) {
    const cached = localStorage.getItem('cached_commits');
    const cacheTimestamp = localStorage.getItem('commits_cache_time');
    
    if (cached && cacheTimestamp) {
      const timestamp = parseInt(cacheTimestamp, 10);
      const now = Date.now();
      
      // Use cached data if it's less than CACHE_TIME seconds old
      if (now - timestamp < CACHE_TIME * 1000) {
        try {
          return JSON.parse(cached);
        } catch {
          // Silent error - if cache is corrupt, fetch fresh data
        }
      }
    }
  }
  
  let retries = 0;
  let lastError: Error | null = null;
  
  while (retries < maxRetries) {
    try {
      // Fetch commits from GitHub API
      const headers: Record<string, string> = {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'GTA-RP-Player-Count-Tracker'
      };
      
      // Add auth token if available
      if (GITHUB_TOKEN) {
        headers['Authorization'] = `token ${GITHUB_TOKEN}`;
      }
      
      const response = await fetch(
        `https://api.github.com/repos/${OWNER}/${REPO}/commits?per_page=50`,
        { headers }
      );
      
      // Handle rate limiting - retry with exponential backoff
      if (response.status === 403 && response.headers.get('X-RateLimit-Remaining') === '0') {
        // Silent error in production
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retries)));
        retries++;
        continue;
      }
      
      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      }
      
      const commits = await response.json();
      
      // Transform and sanitize commit data
      const sanitizedCommits = commits.map(sanitizeCommitData);
      
      // Cache the results
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          localStorage.setItem('cached_commits', JSON.stringify(sanitizedCommits));
          localStorage.setItem('commits_cache_time', Date.now().toString());
        } catch {
          // Silent error - failing to cache isn't critical
        }
      }
      
      return sanitizedCommits;
    } catch (error) {
      // Store error for potential retry
      lastError = error instanceof Error ? error : new Error(String(error));
      retries++;
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retries)));
    }
  }
  
  // After max retries, try to use stale data from cache
  if (typeof window !== 'undefined' && window.localStorage) {
    const staleData = localStorage.getItem('cached_commits');
    
    if (staleData) {
      // Silent warning in production
      try {
        return JSON.parse(staleData);
      } catch {
        // Silent error - corrupt cache
      }
    }
  }
  
  // If all else fails, throw the last encountered error
  throw lastError || new Error('Failed to fetch commit data');
} 
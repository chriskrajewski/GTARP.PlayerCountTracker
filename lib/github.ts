import { Octokit } from "octokit";

// Only keep safe information from commit data
function sanitizeCommitData(commit: any) {
  try {
    return {
      id: commit.sha.substring(0, 8),
      message: commit.commit.message
        ? commit.commit.message.substring(0, 200) // Limit message length for safety
        : "No message",
      date: new Date(commit.commit.author.date).toISOString(),
      url: "#" // Remove actual URL to repository
    };
  } catch (error) {
    // Handle malformed data
    console.error("Error sanitizing commit data:", error);
    return {
      id: "unknown",
      message: "Invalid commit data",
      date: new Date().toISOString(),
      url: "#"
    };
  }
}

// List of commit IDs to exclude from the changelog
const EXCLUDED_COMMIT_IDS = [
  "bb3b7417", // Hidden for security reasons
];

// Cache mechanism to avoid hitting rate limits
let commitsCache: any[] = [];
let lastFetchTime = 0;
const CACHE_TTL = 3600 * 1000; // 1 hour in milliseconds
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

export async function getAnonymizedCommits() {
  // Check if we have cached data that's still valid
  const now = Date.now();
  if (commitsCache.length > 0 && now - lastFetchTime < CACHE_TTL) {
    return commitsCache;
  }

  // Repository information - preferably from environment variables with fallbacks
  const repoOwner = process.env.GITHUB_REPO_OWNER || "chriskrajewski";
  const repoName = process.env.GITHUB_REPO_NAME || "GTARP.PlayerCountTracker";
  
  // Optional GitHub token for higher rate limits
  const githubToken = process.env.GITHUB_TOKEN;
  
  let retries = 0;
  
  while (retries < MAX_RETRIES) {
    try {
      // Initialize Octokit with or without authentication
      const octokit = githubToken 
        ? new Octokit({ auth: githubToken }) 
        : new Octokit();
      
      const response = await octokit.request('GET /repos/{owner}/{repo}/commits', {
        owner: repoOwner,
        repo: repoName,
        per_page: 30, // Increased to 30 to compensate for filtering out merge commits
        headers: {
          'X-GitHub-Api-Version': '2022-11-28'
        }
      });
      
      if (response.status !== 200) {
        throw new Error(`GitHub API returned status ${response.status}`);
      }
      
      // Sanitize and cache the commit data
      const sanitizedCommits = Array.isArray(response.data) 
        ? response.data
            // Filter out excluded commit IDs and merge pull requests
            .filter(commit => {
              // Filter out excluded commit IDs
              if (EXCLUDED_COMMIT_IDS.includes(commit.sha.substring(0, 8))) {
                return false;
              }
              
              // Filter out merge pull request commits
              if (commit.commit && commit.commit.message && 
                  commit.commit.message.trim().startsWith('Merge pull request')) {
                return false;
              }
              
              return true;
            })
            .map(sanitizeCommitData)
        : [];
        
      commitsCache = sanitizedCommits;
      lastFetchTime = now;
      
      return sanitizedCommits;
    } catch (error: any) {
      retries++;
      
      // Check if we should retry based on the error
      if (error.status === 403 && error.headers && error.headers['x-ratelimit-remaining'] === '0') {
        console.error("GitHub API rate limit exceeded. Retrying later.");
        
        // If this is not our last retry, wait before trying again
        if (retries < MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * retries));
        }
      } else if (retries < MAX_RETRIES) {
        // For other errors, retry with backoff
        console.error(`Error fetching GitHub commits (attempt ${retries}):`, error);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * retries));
      } else {
        // Last retry failed, log and return empty array
        console.error("Failed to fetch GitHub commits after maximum retries:", error);
        return [];
      }
    }
  }
  
  // If all retries failed and we have cached data, return that even if expired
  if (commitsCache.length > 0) {
    console.warn("Returning stale commit data after failed retries");
    return commitsCache;
  }
  
  return [];
} 
import { Octokit } from "octokit";

// Anonymize sensitive data
function anonymizeCommitData(commit: any) {
  return {
    id: commit.sha.substring(0, 8),
    message: commit.commit.message,
    date: new Date(commit.commit.author.date).toISOString(),
    url: "#" // Remove actual URL to repository
  };
}

export async function getAnonymizedCommits() {
  try {
    // The repository information is hardcoded here but never exposed to the client
    const repoOwner = "chriskrajewski";
    const repoName = "GTARP.PlayerCountTracker";
    
    // Use GitHub API without authentication for public repositories
    // You can add authentication for private repos or to increase rate limits
    const octokit = new Octokit();
    
    const response = await octokit.request('GET /repos/{owner}/{repo}/commits', {
      owner: repoOwner,
      repo: repoName,
      per_page: 20
    });
    
    if (response.status !== 200) {
      throw new Error(`GitHub API returned status ${response.status}`);
    }
    
    // Anonymize the commit data
    const anonymizedCommits = response.data.map(anonymizeCommitData);
    
    return anonymizedCommits;
  } catch (error) {
    console.error("Error fetching GitHub commits:", error);
    return [];
  }
} 
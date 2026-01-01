"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";

type Commit = {
  id: string;
  message: string;
  date: string;
  url: string;
};

interface RawCommit {
  id?: string;
  message?: string;
  date?: string;
  url?: string;
  [key: string]: any;
}

interface CommitResponse {
  commits: RawCommit[];
}

interface GitCommitsTabProps {
  isOpen: boolean;
}

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit"
});

function formatTimestamp(timestamp: string) {
  try {
    return dateFormatter.format(new Date(timestamp));
  } catch (_err) {
    return timestamp;
  }
}

export function GitCommitsTab({ isOpen }: GitCommitsTabProps) {
  const [commits, setCommits] = useState<Commit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 2;

  useEffect(() => {
    if (!isOpen) return;

    async function fetchChangelog() {
      try {
        setIsLoading(true);
        setError(null);

        const cacheBuster = process.env.NODE_ENV === 'development'
          ? `?_=${Date.now()}`
          : '';

        const response = await fetch(`/api/changelog${cacheBuster}`, {
          headers: {
            'Accept': 'application/json',
          },
          signal: AbortSignal.timeout(5000)
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch changelog: ${response.status}`);
        }

        const data = await response.json() as CommitResponse;

        if (!data || !Array.isArray(data.commits)) {
          throw new Error('Invalid response format');
        }

        const sanitizedCommits = data.commits
          .filter((commit): commit is Commit => (
            typeof commit === 'object' &&
            commit !== null &&
            typeof commit.id === 'string' &&
            typeof commit.message === 'string' &&
            typeof commit.date === 'string'
          ))
          .map((commit: Commit) => ({
            ...commit,
            message: typeof commit.message === 'string'
              ? commit.message.substring(0, 300)
              : 'Invalid message format'
          }));

        setCommits(sanitizedCommits);
      } catch (err: any) {
        console.error("Error loading changelog:", err);

        if (err.name === 'AbortError') {
          setError("Request timed out. Please try again later.");
        } else if (err.name === 'TypeError' && err.message.includes('Failed to fetch')) {
          setError("Network error. Please check your connection.");
        } else {
          setError("Failed to load changelog. Please try again later.");
        }

        if (retryCount < maxRetries) {
          setRetryCount(prev => prev + 1);
          setTimeout(fetchChangelog, 1000 * retryCount);
        }
      } finally {
        setIsLoading(false);
      }
    }

    fetchChangelog();
  }, [isOpen, retryCount]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-pulse flex flex-col gap-4 w-full">
          <div className="h-6 bg-[#18181b] rounded w-3/4"></div>
          <div className="h-4 bg-[#18181b] rounded w-1/2"></div>
          <div className="h-4 bg-[#18181b] rounded w-5/6"></div>
          <div className="h-4 bg-[#18181b] rounded w-3/4"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/40 p-4 rounded-md flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-red-400 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-red-300 font-medium">Unable to load git commits</p>
          <p className="text-red-300/80 text-sm mt-1">{error}</p>
          <p className="text-red-300/70 text-xs mt-2">
            {error.includes('access denied') || error.includes('403') 
              ? 'The GitHub token may not have the required permissions. Ensure GITHUB_TOKEN has the "repo" scope.'
              : error.includes('not found') || error.includes('404')
              ? 'The repository could not be found. Check GITHUB_REPO_OWNER and GITHUB_REPO_NAME settings.'
              : 'Please check your network connection and try again.'}
          </p>
          <button
            onClick={() => setRetryCount(prev => prev + 1)}
            className="mt-3 text-sm bg-red-500/20 text-red-300 px-3 py-1 rounded-md hover:bg-red-500/30 transition-colors"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {commits.length === 0 ? (
        <div className="flex items-center justify-center py-8">
          <p className="text-[#ADADB8]">No git commits available</p>
        </div>
      ) : (
        <div className="space-y-4">
          {commits.map((commit, index) => (
            <div key={commit.id}>
              <div className="flex flex-col space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-[#ADADB8]">
                    {formatTimestamp(commit.date)}
                  </span>
                  <span className="text-xs text-[#ADADB8] font-mono">
                    {commit.id.substring(0, 7)}
                  </span>
                </div>
                <p className="text-sm text-[#EFEFF1]">{commit.message}</p>
              </div>
              {index < commits.length - 1 && <Separator className="mt-4 bg-[#26262c]" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

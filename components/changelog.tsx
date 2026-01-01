"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { AlertCircle } from "lucide-react";

type Commit = {
  id: string;
  message: string;
  date: string;
  url: string;
};

// Interface for raw commit data from API
interface RawCommit {
  id?: string;
  message?: string;
  date?: string;
  url?: string;
  [key: string]: any;
}

// Interface for the API response
interface CommitResponse {
  commits: RawCommit[];
}

export default function Changelog() {
  const [commits, setCommits] = useState<Commit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 2;

  useEffect(() => {
    async function fetchChangelog() {
      try {
        setIsLoading(true);
        
        // Add a cache-busting parameter for development only
        const cacheBuster = process.env.NODE_ENV === 'development' 
          ? `?_=${Date.now()}` 
          : '';
          
        const response = await fetch(`/api/changelog${cacheBuster}`, {
          headers: {
            'Accept': 'application/json',
          },
          // Add a reasonable timeout
          signal: AbortSignal.timeout(5000)
        });
        
        if (!response.ok) {
          throw new Error(`Failed to fetch changelog: ${response.status}`);
        }
        
        const data = await response.json() as CommitResponse;
        
        // Validate the response structure
        if (!data || !Array.isArray(data.commits)) {
          throw new Error('Invalid response format');
        }
        
        // Security: Validate and sanitize each commit
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
            // Ensure the message is a reasonable length
            message: typeof commit.message === 'string' 
              ? commit.message.substring(0, 300) 
              : 'Invalid message format'
          }));
        
        setCommits(sanitizedCommits);
      } catch (err: any) {
        console.error("Error loading changelog:", err);
        
        // Provide a user-friendly error message
        if (err.name === 'AbortError') {
          setError("Request timed out. Please try again later.");
        } else if (err.name === 'TypeError' && err.message.includes('Failed to fetch')) {
          setError("Network error. Please check your connection.");
        } else {
          setError("Failed to load changelog. Please try again later.");
        }
        
        // Retry logic for transient errors
        if (retryCount < maxRetries) {
          setRetryCount(prev => prev + 1);
          setTimeout(fetchChangelog, 1000 * retryCount);
        }
      } finally {
        setIsLoading(false);
      }
    }

    fetchChangelog();
  }, [retryCount]);

  // Format date to be more readable
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      
      // Check if the date is valid
      if (isNaN(date.getTime())) {
        return "Invalid date";
      }
      
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch (err) {
      console.error("Error formatting date:", err);
      return "Date error";
    }
  };

  // Format commit message to handle multiline commits
  const formatMessage = (message: string) => {
    // Security: Ensure the message is treated as plain text
    try {
      // Split by new lines and take only the first line (the subject)
      const firstLine = (message || "").split("\n")[0];
      // Truncate if too long
      return firstLine.length > 200 ? `${firstLine.substring(0, 200)}...` : firstLine;
    } catch (err) {
      console.error("Error formatting message:", err);
      return "Error displaying message";
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Changelog</CardTitle>
          <CardDescription>Recent updates to the application</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-6" aria-live="polite" aria-busy="true">
            <div className="animate-pulse flex flex-col gap-4 w-full">
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Changelog</CardTitle>
          <CardDescription>Recent updates to the application</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-md flex items-start gap-3" role="alert">
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-red-700 dark:text-red-300 font-medium">Unable to load changelog</p>
              <p className="text-red-600 dark:text-red-300 text-sm mt-1">{error}</p>
              <button 
                onClick={() => setRetryCount(prev => prev + 1)}
                className="mt-3 text-sm bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-200 px-3 py-1 rounded-md hover:bg-red-200 dark:hover:bg-red-700 transition-colors"
              >
                Try again
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Changelog</CardTitle>
        <CardDescription>Recent updates to the application</CardDescription>
      </CardHeader>
      <CardContent>
        {commits.length === 0 ? (
          <div className="flex items-center justify-center py-6">
            <p className="text-muted-foreground">No changelog entries available</p>
          </div>
        ) : (
          <div className="space-y-4">
            {commits.map((commit, index) => (
              <div key={commit.id}>
                <div className="flex flex-col space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">
                      {formatDate(commit.date)}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">
                      {commit.id}
                    </span>
                  </div>
                  <p className="text-sm">{formatMessage(commit.message)}</p>
                </div>
                {index < commits.length - 1 && <Separator className="mt-4" />}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
} 
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type Commit = {
  id: string;
  message: string;
  date: string;
  url: string;
};

export default function Changelog() {
  const [commits, setCommits] = useState<Commit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchChangelog() {
      try {
        setIsLoading(true);
        const response = await fetch("/api/changelog");
        
        if (!response.ok) {
          throw new Error(`Failed to fetch changelog: ${response.status}`);
        }
        
        const data = await response.json();
        setCommits(data.commits);
      } catch (err) {
        console.error("Error loading changelog:", err);
        setError("Failed to load changelog. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    }

    fetchChangelog();
  }, []);

  // Format date to be more readable
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Format commit message to handle multiline commits
  const formatMessage = (message: string) => {
    // Split by new lines and take only the first line (the subject)
    const firstLine = message.split("\n")[0];
    return firstLine;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Changelog</CardTitle>
          <CardDescription>Recent updates to the application</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-6">
            <p className="text-muted-foreground">Loading changelog...</p>
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
          <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-md">
            <p className="text-red-700 dark:text-red-300">{error}</p>
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
"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Sparkles, TrendingUp, Wrench, Bell } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import type { Database } from "@/lib/supabase.types";

type SiteUpdate = Database['public']['Tables']['site_updates']['Row'];

type Commit = {
  id: string;
  message: string;
  date: string;
  url: string;
};

interface RecentChangesTabProps {
  isOpen: boolean;
}

const TYPE_CONFIG = {
  feature: {
    icon: Sparkles,
    color: "text-violet-400",
    bgColor: "bg-violet-500/10",
    label: "Feature",
  },
  improvement: {
    icon: TrendingUp,
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    label: "Improvement",
  },
  bugfix: {
    icon: Wrench,
    color: "text-green-400",
    bgColor: "bg-green-500/10",
    label: "Bug Fix",
  },
  announcement: {
    icon: Bell,
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/10",
    label: "Announcement",
  },
};

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function formatDate(dateString: string) {
  try {
    return dateFormatter.format(new Date(dateString));
  } catch (_err) {
    return dateString;
  }
}

export function RecentChangesTab({ isOpen }: RecentChangesTabProps) {
  const [updates, setUpdates] = useState<SiteUpdate[]>([]);
  const [commits, setCommits] = useState<Commit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    async function fetchData() {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch site updates
        const updatesResponse = await fetch("/api/site-updates?limit=20", {
          headers: { "Accept": "application/json" },
          signal: AbortSignal.timeout(5000),
        });

        if (updatesResponse.ok) {
          const updatesData = await updatesResponse.json();
          setUpdates(updatesData.updates || []);
        }

        // Fetch git commits
        const commitsResponse = await fetch("/api/changelog", {
          headers: { "Accept": "application/json" },
          signal: AbortSignal.timeout(5000),
        });

        if (commitsResponse.ok) {
          const commitsData = await commitsResponse.json();
          setCommits(commitsData.commits || []);
        }
      } catch (err: any) {
        console.error("Error loading recent changes:", err);
        setError("Failed to load recent changes. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [isOpen]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-pulse flex flex-col gap-4 w-full">
          <div className="h-6 bg-[#18181b] rounded w-3/4"></div>
          <div className="h-4 bg-[#18181b] rounded w-1/2"></div>
          <div className="h-4 bg-[#18181b] rounded w-5/6"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/40 p-4 rounded-md flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-red-400 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-red-300 font-medium">Unable to load recent changes</p>
          <p className="text-red-300/80 text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  const hasUpdates = updates.length > 0;
  const hasCommits = commits.length > 0;

  return (
    <div className="space-y-4">
      {!hasUpdates && !hasCommits ? (
        <div className="flex items-center justify-center py-8">
          <p className="text-[#ADADB8]">No recent changes available</p>
        </div>
      ) : (
        <>
          {/* Manual Site Updates */}
          {hasUpdates && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-[#ADADB8] uppercase tracking-wider">
                Site Updates
              </h3>
              {updates.map((update, index) => {
                const typeConfig = TYPE_CONFIG[update.type as keyof typeof TYPE_CONFIG] || TYPE_CONFIG.announcement;
                const Icon = typeConfig.icon;
                // Use markdown content if available, otherwise use plain content
                const displayContent = update.content_markdown || update.content;
                const isMarkdown = !!update.content_markdown;

                return (
                  <div key={update.id}>
                    <div className={cn("p-3 rounded-lg border border-[#26262c]", typeConfig.bgColor)}>
                      <div className="flex items-start gap-3">
                        <Icon className={cn("h-4 w-4 mt-0.5 flex-shrink-0", typeConfig.color)} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="text-sm font-semibold text-white">
                              {update.title}
                            </h4>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-xs border-0",
                                typeConfig.color,
                                typeConfig.bgColor
                              )}
                            >
                              {typeConfig.label}
                            </Badge>
                          </div>
                          <div className="text-xs text-[#ADADB8] mb-2 whitespace-normal break-words">
                            {isMarkdown ? (
                              <ReactMarkdown className="prose prose-invert prose-sm max-w-none">
                                {displayContent.substring(0, 300)}
                                {displayContent.length > 300 ? "\n\n..." : ""}
                              </ReactMarkdown>
                            ) : (
                              <>
                                {displayContent.substring(0, 300)}
                                {displayContent.length > 300 ? "..." : ""}
                              </>
                            )}
                          </div>
                          <span className="text-xs text-[#ADADB8]/60">
                            {formatDate(update.publish_date || update.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                    {index < updates.length - 1 && (
                      <Separator className="mt-3 bg-[#26262c]" />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Separator between sections */}
          {hasUpdates && hasCommits && (
            <div className="py-2">
              <Separator className="bg-[#26262c]" />
              <p className="text-xs text-[#ADADB8]/50 text-center mt-2">Git Commits</p>
            </div>
          )}

          {/* Git Commits */}
          {hasCommits && (
            <div className="space-y-3">
              {!hasUpdates && (
                <h3 className="text-xs font-semibold text-[#ADADB8] uppercase tracking-wider">
                  Git Commits
                </h3>
              )}
              {commits.slice(0, 10).map((commit, index) => (
                <div key={commit.id}>
                  <div className="flex flex-col space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-[#ADADB8]">
                        {formatDate(commit.date)}
                      </span>
                      <span className="text-xs text-[#ADADB8] font-mono">
                        {commit.id.substring(0, 7)}
                      </span>
                    </div>
                    <p className="text-sm text-[#EFEFF1] whitespace-normal break-words">{commit.message}</p>
                  </div>
                  {index < Math.min(commits.length - 1, 9) && (
                    <Separator className="mt-3 bg-[#26262c]" />
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

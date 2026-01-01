"use client";

import { Badge } from "@/components/ui/badge";
import { VoteButton } from "./vote-button";
import { Sparkles, TrendingUp, Wrench, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

interface RoadmapItemCardProps {
  id: number;
  title: string;
  description: string;
  description_markdown?: string;
  status: "planned" | "in_progress" | "completed" | "cancelled";
  priority: number;
  category?: string;
  voteCount: number;
  onVoteChange?: (newCount: number, hasVoted: boolean) => void;
}

const STATUS_CONFIG = {
  planned: {
    label: "Planned",
    color: "bg-blue-500/20 border-blue-500/50 text-blue-400",
    bgColor: "bg-blue-500/5",
  },
  in_progress: {
    label: "In Progress",
    color: "bg-yellow-500/20 border-yellow-500/50 text-yellow-400",
    bgColor: "bg-yellow-500/5",
  },
  completed: {
    label: "Completed",
    color: "bg-green-500/20 border-green-500/50 text-green-400",
    bgColor: "bg-green-500/5",
  },
  cancelled: {
    label: "Cancelled",
    color: "bg-gray-500/20 border-gray-500/50 text-gray-400",
    bgColor: "bg-gray-500/5",
  },
};

const PRIORITY_LABELS = {
  1: "Low",
  2: "Low",
  3: "Low",
  4: "Medium",
  5: "Medium",
  6: "Medium",
  7: "High",
  8: "High",
  9: "Critical",
  10: "Critical",
};

const PRIORITY_COLORS = {
  1: "bg-gray-500/20 text-gray-400",
  2: "bg-gray-500/20 text-gray-400",
  3: "bg-gray-500/20 text-gray-400",
  4: "bg-blue-500/20 text-blue-400",
  5: "bg-blue-500/20 text-blue-400",
  6: "bg-blue-500/20 text-blue-400",
  7: "bg-orange-500/20 text-orange-400",
  8: "bg-orange-500/20 text-orange-400",
  9: "bg-red-500/20 text-red-400",
  10: "bg-red-500/20 text-red-400",
};

export function RoadmapItemCard({
  id,
  title,
  description,
  description_markdown,
  status,
  priority,
  category,
  voteCount,
  onVoteChange,
}: RoadmapItemCardProps) {
  const statusConfig = STATUS_CONFIG[status];
  const priorityLabel = PRIORITY_LABELS[priority as keyof typeof PRIORITY_LABELS];
  const priorityColor = PRIORITY_COLORS[priority as keyof typeof PRIORITY_COLORS];
  
  // Use markdown description if available, otherwise use plain description
  const displayDescription = description_markdown || description;
  const isMarkdown = !!description_markdown;

  return (
    <div
      className={cn(
        "p-4 rounded-lg border border-[#26262c] transition-all duration-200 hover:border-cyan-500/30",
        statusConfig.bgColor
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <div className="text-xs text-[#ADADB8] mt-1 whitespace-normal break-words">
            {isMarkdown ? (
              <ReactMarkdown className="prose prose-invert prose-sm max-w-none">
                {displayDescription}
              </ReactMarkdown>
            ) : (
              displayDescription
            )}
          </div>
        </div>
      </div>

      {/* Badges and Status */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <Badge
          variant="outline"
          className={cn("text-xs border", statusConfig.color)}
        >
          {statusConfig.label}
        </Badge>

        <Badge
          variant="outline"
          className={cn("text-xs border-0", priorityColor)}
        >
          Priority: {priorityLabel}
        </Badge>

        {category && (
          <Badge
            variant="outline"
            className="text-xs border-[#26262c] text-[#ADADB8]"
          >
            {category}
          </Badge>
        )}
      </div>

      {/* Vote Button */}
      <div className="flex justify-end">
        <VoteButton
          itemId={id}
          initialVoteCount={voteCount}
          onVoteChange={onVoteChange}
        />
      </div>
    </div>
  );
}

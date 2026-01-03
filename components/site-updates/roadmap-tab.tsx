"use client";

import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";
import { RoadmapItemCard } from "./roadmap-item-card";
import type { Database } from "@/lib/supabase.types";

type RoadmapItem = Database['public']['Tables']['roadmap_items']['Row'];

interface RoadmapTabProps {
  isOpen: boolean;
}

const STATUS_ORDER = {
  in_progress: 0,
  planned: 1,
  completed: 2,
  cancelled: 3,
};

const STATUS_LABELS = {
  planned: "Planned",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

export function RoadmapTab({ isOpen }: RoadmapTabProps) {
  const [items, setItems] = useState<RoadmapItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [showOnlyInProgress, setShowOnlyInProgress] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    async function fetchData() {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch("/api/roadmap?limit=100", {
          headers: { "Accept": "application/json" },
          signal: AbortSignal.timeout(5000),
        });

        if (!response.ok) {
          throw new Error("Failed to fetch roadmap items");
        }

        const data = await response.json();
        const roadmapItems = data.items || [];

        // Extract unique categories
        const uniqueCategories = Array.from(
          new Set(roadmapItems.map((item: RoadmapItem) => item.category).filter(Boolean))
        ) as string[];

        setItems(roadmapItems);
        setCategories(uniqueCategories);
      } catch (err: any) {
        console.error("Error loading roadmap:", err);
        setError("Failed to load roadmap. Please try again later.");
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
          <p className="text-red-300 font-medium">Unable to load roadmap</p>
          <p className="text-red-300/80 text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  // Filter items by selected category and in-progress status
  let filteredItems = selectedCategory
    ? items.filter(item => item.category === selectedCategory)
    : items;

  if (showOnlyInProgress) {
    filteredItems = filteredItems.filter(item => item.status === 'in_progress');
  }

  // Group items by status
  const groupedItems = {
    planned: filteredItems.filter(item => item.status === "planned"),
    in_progress: filteredItems.filter(item => item.status === "in_progress"),
    completed: filteredItems.filter(item => item.status === "completed"),
    cancelled: filteredItems.filter(item => item.status === "cancelled"),
  };

  return (
    <div className="space-y-4">
      {/* Category Filter and In Progress Toggle */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2 pb-3 border-b border-[#26262c]">
          <button
            onClick={() => setShowOnlyInProgress(!showOnlyInProgress)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
              showOnlyInProgress
                ? "bg-yellow-500/20 border border-yellow-500/50 text-yellow-400"
                : "bg-[#26262c]/50 border border-[#40404a] text-[#ADADB8] hover:border-yellow-500/30"
            }`}
          >
            In Progress Only
          </button>
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
              selectedCategory === null
                ? "bg-cyan-500/20 border border-cyan-500/50 text-cyan-400"
                : "bg-[#26262c]/50 border border-[#40404a] text-[#ADADB8] hover:border-cyan-500/30"
            }`}
          >
            All
          </button>
          {categories.map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                selectedCategory === category
                  ? "bg-cyan-500/20 border border-cyan-500/50 text-cyan-400"
                  : "bg-[#26262c]/50 border border-[#40404a] text-[#ADADB8] hover:border-cyan-500/30"
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      )}

      {/* Roadmap Items Grouped by Status */}
      {filteredItems.length === 0 ? (
        <div className="flex items-center justify-center py-8">
          <p className="text-[#ADADB8]">
            {selectedCategory ? "No items in this category" : "No roadmap items available"}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {(Object.keys(groupedItems) as Array<keyof typeof groupedItems>)
            .sort((a, b) => STATUS_ORDER[a] - STATUS_ORDER[b])
            .map(status => {
              const statusItems = groupedItems[status];
              if (statusItems.length === 0) return null;

              return (
                <div key={status}>
                  <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                    {STATUS_LABELS[status]}
                    <span className="text-xs font-normal text-[#ADADB8] bg-[#26262c]/50 px-2 py-0.5 rounded-full">
                      {statusItems.length}
                    </span>
                  </h3>
                  <div className="space-y-3">
                    {statusItems.map(item => (
                      <RoadmapItemCard
                        key={item.id}
                        id={item.id}
                        title={item.title}
                        description={item.description}
                        status={item.status as "planned" | "in_progress" | "completed" | "cancelled"}
                        priority={item.priority}
                        category={item.category || undefined}
                        voteCount={item.vote_count || 0}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}

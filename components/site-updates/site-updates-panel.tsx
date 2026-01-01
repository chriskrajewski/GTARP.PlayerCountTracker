"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GitCommitsTab } from "./git-commits-tab";
import { RecentChangesTab } from "./recent-changes-tab";
import { RoadmapTab } from "./roadmap-tab";
import { History, Sparkles, Map } from "lucide-react";

interface SiteUpdatesPanelProps {
  isOpen: boolean;
}

export function SiteUpdatesPanel({ isOpen }: SiteUpdatesPanelProps) {
  const [activeTab, setActiveTab] = useState("recent-changes");

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-[#18181b] border border-[#26262c]">
          <TabsTrigger
            value="recent-changes"
            className="flex items-center gap-2 data-[state=active]:bg-[#26262c] data-[state=active]:text-cyan-400"
          >
            <Sparkles className="h-4 w-4" />
            <span className="hidden sm:inline">Recent Changes</span>
            <span className="sm:hidden">Changes</span>
          </TabsTrigger>
          <TabsTrigger
            value="roadmap"
            className="flex items-center gap-2 data-[state=active]:bg-[#26262c] data-[state=active]:text-cyan-400"
          >
            <Map className="h-4 w-4" />
            <span className="hidden sm:inline">Roadmap</span>
            <span className="sm:hidden">Map</span>
          </TabsTrigger>
          <TabsTrigger
            value="git-commits"
            className="flex items-center gap-2 data-[state=active]:bg-[#26262c] data-[state=active]:text-cyan-400"
          >
            <History className="h-4 w-4" />
            <span className="hidden sm:inline">Git Commits</span>
            <span className="sm:hidden">Git</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="recent-changes" className="mt-4">
          <RecentChangesTab isOpen={isOpen && activeTab === "recent-changes"} />
        </TabsContent>

        <TabsContent value="roadmap" className="mt-4">
          <RoadmapTab isOpen={isOpen && activeTab === "roadmap"} />
        </TabsContent>

        <TabsContent value="git-commits" className="mt-4">
          <GitCommitsTab isOpen={isOpen && activeTab === "git-commits"} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

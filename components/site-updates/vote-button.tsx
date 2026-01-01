"use client";

import { useState, useEffect } from "react";
import { Heart } from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

interface VoteButtonProps {
  itemId: number;
  initialVoteCount: number;
  onVoteChange?: (newCount: number, hasVoted: boolean) => void;
}

const STORAGE_KEY = "roadmap_votes";

export function VoteButton({ itemId, initialVoteCount, onVoteChange }: VoteButtonProps) {
  const [voteCount, setVoteCount] = useState(initialVoteCount);
  const [hasVoted, setHasVoted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Check if user has already voted on this item
  useEffect(() => {
    const votes = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    setHasVoted(votes[itemId] === true);
  }, [itemId]);

  const handleVote = async () => {
    if (isLoading) return;

    setIsLoading(true);
    const votes = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");

    try {
      if (hasVoted) {
        // Remove vote
        const response = await fetch(`/api/roadmap/vote?item_id=${itemId}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to remove vote");
        }

        // Update local state
        setHasVoted(false);
        setVoteCount(prev => Math.max(0, prev - 1));
        delete votes[itemId];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(votes));

        toast({
          title: "Vote removed",
          description: "Your vote has been removed from this roadmap item.",
        });
      } else {
        // Add vote
        const response = await fetch("/api/roadmap/vote", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ roadmap_item_id: itemId }),
        });

        if (!response.ok) {
          const error = await response.json();
          if (response.status === 409) {
            throw new Error("You have already voted on this item");
          }
          throw new Error(error.error || "Failed to add vote");
        }

        // Update local state
        setHasVoted(true);
        setVoteCount(prev => prev + 1);
        votes[itemId] = true;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(votes));

        toast({
          title: "Vote added",
          description: "Thank you for voting on this roadmap item!",
        });
      }

      // Notify parent component
      if (onVoteChange) {
        onVoteChange(hasVoted ? voteCount - 1 : voteCount + 1, !hasVoted);
      }
    } catch (error) {
      console.error("Error voting:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to process vote",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.button
      onClick={handleVote}
      disabled={isLoading}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 ${
        hasVoted
          ? "bg-cyan-500/20 border border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/30"
          : "bg-[#26262c]/50 border border-[#40404a] text-[#ADADB8] hover:border-cyan-500/30 hover:text-cyan-400"
      } ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
      whileHover={!isLoading ? { scale: 1.05 } : {}}
      whileTap={!isLoading ? { scale: 0.95 } : {}}
    >
      <motion.div
        animate={hasVoted ? { scale: [1, 1.2, 1] } : {}}
        transition={{ duration: 0.3 }}
      >
        <Heart
          className={`h-4 w-4 ${hasVoted ? "fill-current" : ""}`}
        />
      </motion.div>
      <span className="text-sm font-medium">{voteCount}</span>
    </motion.button>
  );
}

import Changelog from "@/components/changelog";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export const metadata = {
  title: "Changelog - FiveM Player Count Tracker",
  description: "View the latest updates and changes to the FiveM Player Count Tracker"
};

export default function ChangelogPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-6">
        <Link 
          href="/" 
          className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Home
        </Link>
        <h1 className="text-3xl font-bold">Changelog</h1>
      </div>
      <p className="text-muted-foreground mb-8">
        Stay up to date with the latest improvements and updates to the FiveM Player Count Tracker.
      </p>
      <Changelog />
    </div>
  );
} 
import Changelog from "@/components/changelog";
import { CommonLayout } from "@/components/common-layout";

export const metadata = {
  title: "Changelog - FiveM Player Count Tracker",
  description: "View the latest updates and changes to the FiveM Player Count Tracker"
};

export default function ChangelogPage() {
  return (
    <CommonLayout showBackButton pageTitle="Changelog">
      <div className="py-6">
        <p className="text-gray-400 mb-8">
        Stay up to date with the latest improvements and updates to the FiveM Player Count Tracker.
      </p>
      <Changelog />
    </div>
    </CommonLayout>
  );
} 
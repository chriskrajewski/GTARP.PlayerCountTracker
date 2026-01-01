import { CommonLayout } from "@/components/common-layout";
import { SiteUpdatesPanel } from "@/components/site-updates/site-updates-panel";

export const metadata = {
  title: "Site Updates - FiveM Player Count Tracker",
  description: "View recent changes, roadmap, and git commits for the FiveM Player Count Tracker"
};

export default function SiteUpdatesPage() {
  return (
    <CommonLayout showBackButton pageTitle="Site Updates">
      <div className="py-6">
        <p className="text-gray-400 mb-8">
          Stay up to date with recent changes, upcoming features, and development progress.
        </p>
        <SiteUpdatesPanel isOpen={true} />
      </div>
    </CommonLayout>
  );
}

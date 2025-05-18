import { Suspense } from "react";
import ServerStreams from "@/components/server-streams";
import { getServerName } from "@/lib/data";
import { CommonLayout } from "@/components/common-layout";

interface ServerStreamsPageProps {
  params: {
    serverId: string;
  };
}

export default async function ServerStreamsPage(props: ServerStreamsPageProps) {
  // In Next.js App Router, we need to await params before accessing
  const params = await Promise.resolve(props.params);
  const serverId = params.serverId;
  const serverName = await getServerName(serverId);

  return (
    <CommonLayout showBackButton pageTitle={`Live Streams: ${serverName}`}>
      <div>
        <p className="text-gray-400 mb-6">
          Watch live streamers currently playing on {serverName}, and multi-stream them! [feature is in beta 😄]
        </p>

        <Suspense fallback={<div className="text-center py-20 text-gray-400">Loading streams...</div>}>
          <ServerStreams serverId={serverId} serverName={serverName} />
        </Suspense>
      </div>
    </CommonLayout>
  );
} 
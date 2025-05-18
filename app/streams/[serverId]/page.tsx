import { Suspense } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import ServerStreams from "@/components/server-streams";
import { getServerName } from "@/lib/data";

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
    <main className="min-h-screen p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center mb-6">
          <Link href="/">
            <Button variant="outline" size="icon" className="mr-4">
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Back to Home</span>
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Live Streams: {serverName}</h1>
        </div>

        <p className="text-muted-foreground mb-6">
          Watch live streamers currently playing on {serverName}
        </p>

        <Suspense fallback={<div className="text-center py-20">Loading streams...</div>}>
          <ServerStreams serverId={serverId} serverName={serverName} />
        </Suspense>
      </div>
    </main>
  );
} 
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { createServerClient } from '@/lib/supabase-server';
import { ServerClips } from '@/components/server-clips';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata = {
  title: 'Server Clips',
  description: 'Browse clips from streamers on your favorite servers',
};

function ClipsLoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-64 w-full" />
      ))}
    </div>
  );
}

export default async function ClipsPage({
  params,
}: {
  params: { serverId: string };
}) {
  const supabase = createServerClient();

  const { data: server } = await supabase
    .from('server_xref')
    .select('id, serverName')
    .eq('id', params.serverId)
    .single();

  if (!server) {
    notFound();
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">
          {server.serverName} - Clips
        </h1>
        <p className="text-gray-400">
          Browse clips from streamers who have played on {server.serverName}
        </p>
      </div>
      <Suspense fallback={<ClipsLoadingSkeleton />}>
        <ServerClips serverId={params.serverId} serverName={server.serverName} />
      </Suspense>
    </div>
  );
}

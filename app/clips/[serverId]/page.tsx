import { Suspense } from 'react';
import { createServerClient } from '@/lib/supabase-server';
import { ServerClips } from '@/components/server-clips';
import { CommonLayout } from '@/components/common-layout';
import { Skeleton } from '@/components/ui/skeleton';

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
  params: Promise<{ serverId: string }>;
}) {
  const { serverId } = await params;
  const supabase = createServerClient();

  const { data: server } = await supabase
    .from('server_xref')
    .select('server_id, server_name')
    .eq('server_id', serverId)
    .single();

  if (!server) {
    return <div>Server not found</div>;
  }

  return (
    <CommonLayout showBackButton pageTitle={`Clips: ${server.server_name}`}>
      <div>
        <p className="text-gray-400 mb-6">
          Browse clips from streamers who have played on {server.server_name}
        </p>

        <Suspense fallback={<ClipsLoadingSkeleton />}>
          <ServerClips serverId={serverId} serverName={server.server_name} />
        </Suspense>
      </div>
    </CommonLayout>
  );
}

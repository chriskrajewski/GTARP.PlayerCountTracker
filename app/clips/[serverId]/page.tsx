'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import { CommonLayout } from '@/components/common-layout';
import { AllClipsContent, ClipsLoadingSkeleton, PageHeader } from '../page';

export default function ServerClipsPage() {
  const params = useParams<{ serverId?: string }>();
  const serverIdParam = params?.serverId;
  const serverId = Array.isArray(serverIdParam) ? serverIdParam[0] : serverIdParam;
  const pagePath = serverId ? `/clips/${serverId}` : '/clips';

  return (
    <CommonLayout showBackButton pageTitle="Clips">
      <PageHeader />
      <Suspense fallback={<ClipsLoadingSkeleton />}>
        <AllClipsContent defaultServerId={serverId} pagePath={pagePath} />
      </Suspense>
    </CommonLayout>
  );
}

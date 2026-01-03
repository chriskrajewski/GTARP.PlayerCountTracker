'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ServerClips } from '@/components/server-clips';
import { CommonLayout } from '@/components/common-layout';
import { Card, CardContent } from '@/components/ui/card';
import { motion, AnimatedSkeleton } from '@/components/ui/motion';
import { fadeInUp, staggerContainer } from '@/lib/motion';
import { Film, Sparkles } from 'lucide-react';
import { getServerName } from '@/lib/data';

// ═══════════════════════════════════════════════════════════════════════════
// LOADING SKELETON
// ═══════════════════════════════════════════════════════════════════════════

function ClipsLoadingSkeleton() {
  return (
    <motion.div 
      className="space-y-6"
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
    >
      {/* Stats skeleton */}
      <motion.div 
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
        variants={fadeInUp}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} variant="elevated" animated={false}>
            <CardContent className="p-4">
              <AnimatedSkeleton className="h-3 w-16 mb-2" />
              <AnimatedSkeleton className="h-6 w-12" />
            </CardContent>
          </Card>
        ))}
      </motion.div>

      {/* Filters skeleton */}
      <motion.div variants={fadeInUp}>
        <Card variant="elevated" animated={false}>
          <CardContent className="p-6 space-y-4">
            <AnimatedSkeleton className="h-5 w-32 mb-4" />
            <AnimatedSkeleton className="h-12 w-full" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <AnimatedSkeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Clips grid skeleton */}
      <motion.div 
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        variants={fadeInUp}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} variant="elevated" animated={false}>
            <CardContent className="p-0">
              <AnimatedSkeleton className="w-full aspect-video rounded-none" />
              <div className="p-4 space-y-3">
                <AnimatedSkeleton className="h-4 w-full" />
                <AnimatedSkeleton className="h-3 w-2/3" />
                <div className="flex gap-4">
                  <AnimatedSkeleton className="h-3 w-1/4" />
                  <AnimatedSkeleton className="h-3 w-1/4" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </motion.div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE HEADER COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

function PageHeader({ serverName }: { serverName: string }) {
  return (
    <motion.div 
      className="mb-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="flex items-center gap-3 mb-2">
        <motion.div
          className="w-10 h-10 rounded-lg flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.2) 0%, rgba(20, 184, 166, 0.1) 100%)',
            border: '1px solid rgba(168, 85, 247, 0.3)',
          }}
          whileHover={{ scale: 1.05, rotate: 5 }}
        >
          <Film className="h-5 w-5 text-purple-400" />
        </motion.div>
        <div>
          <p className="text-gray-400 text-sm flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
            Twitch Clips Collection
          </p>
        </div>
      </div>
      <p className="text-gray-400 leading-relaxed">
        Browse and watch clips from streamers who have played on{' '}
        <span className="text-purple-300 font-medium">{serverName}</span>.
        Discover highlights, funny moments, and epic roleplay.
      </p>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function ClipsPage() {
  const params = useParams();
  const serverId = params.serverId as string;
  const [serverName, setServerName] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // Fetch server name using the data lib function
  useEffect(() => {
    const fetchServerName = async () => {
      try {
        const name = await getServerName(serverId);
        setServerName(name);
      } catch (err) {
        console.error('[ClipsPage] Error fetching server name:', err);
        setServerName(`Server ${serverId}`);
      } finally {
        setLoading(false);
      }
    };

    if (serverId) {
      fetchServerName();
    }
  }, [serverId]);

  if (loading) {
    return (
      <CommonLayout showBackButton pageTitle="Clips">
        <ClipsLoadingSkeleton />
      </CommonLayout>
    );
  }

  return (
    <CommonLayout showBackButton pageTitle={`Clips: ${serverName}`}>
      <PageHeader serverName={serverName} />
      <Suspense fallback={<ClipsLoadingSkeleton />}>
        <ServerClips serverId={serverId} serverName={serverName} />
      </Suspense>
    </CommonLayout>
  );
}

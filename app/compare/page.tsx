'use client';

import { Suspense, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CommonLayout } from '@/components/common-layout';
import { useFailClosedFeatureFlagState, FEATURE_FLAGS } from '@/lib/feature-flags';
import { motion } from '@/components/ui/motion';
import { BarChart3, Sparkles } from 'lucide-react';
import { ComparisonView } from '@/components/comparison/comparison-view';

/**
 * Page header for the Server Comparison View, matching the cyber/neon aesthetic
 * used across the rest of the app.
 */
function PageHeader() {
  return (
    <motion.div
      className="mb-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="mb-2 flex items-center gap-3">
        <motion.div
          className="flex h-10 w-10 items-center justify-center rounded-lg"
          style={{
            background:
              'linear-gradient(135deg, rgba(0, 217, 255, 0.2) 0%, rgba(20, 184, 166, 0.1) 100%)',
            border: '1px solid rgba(0, 217, 255, 0.3)',
          }}
          whileHover={{ scale: 1.05, rotate: 5 }}
        >
          <BarChart3 className="h-5 w-5 text-cyan-400" />
        </motion.div>
        <div>
          <p className="flex items-center gap-1.5 text-sm text-gray-400">
            <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
            Server Comparison
          </p>
        </div>
      </div>
      <p className="leading-relaxed text-gray-400">
        Pin <span className="font-medium text-cyan-300">2 to 4 servers</span> to overlay their
        player counts and compare current activity, peaks, and predicted restarts side by side.
      </p>
    </motion.div>
  );
}

/**
 * Server Comparison View page (R2).
 *
 * Gated by the fail-closed `comparison_view` flag (R1.2/R1.4): the surface is
 * shown only when the flag is explicitly enabled. When disabled (including
 * while loading or on a flag fetch error), the page redirects to `/`, matching
 * the gating pattern used by `app/favorites/page.tsx`.
 */
export default function ComparePage() {
  const router = useRouter();
  const { enabled: isComparisonEnabled, loading: flagsLoading } = useFailClosedFeatureFlagState(
    FEATURE_FLAGS.COMPARISON_VIEW,
  );

  useEffect(() => {
    // Only redirect once flags have resolved — redirecting during load would
    // bounce away on the fail-closed default before the real value arrives.
    if (!flagsLoading && !isComparisonEnabled) {
      router.replace('/');
    }
  }, [flagsLoading, isComparisonEnabled, router]);

  // While flags load, or when disabled, render nothing (avoids flashing gated
  // content and avoids a premature redirect).
  if (flagsLoading || !isComparisonEnabled) {
    return null;
  }

  return (
    <CommonLayout showBackButton pageTitle="Server Comparison">
      <PageHeader />
      <Suspense fallback={<div className="py-12 text-center text-[#ADADB8]">Loading…</div>}>
        <ComparisonView />
      </Suspense>
    </CommonLayout>
  );
}

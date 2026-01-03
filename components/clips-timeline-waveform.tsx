'use client';

import { memo, useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from '@/components/ui/motion';
import { Card, CardContent } from '@/components/ui/card';
import { Eye, TrendingUp, TrendingDown, Minus, Calendar, Clock, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

// ═══════════════════════════════════════════════════════════════════════════
// INTERFACES
// ═══════════════════════════════════════════════════════════════════════════

interface ClipData {
  clip_id: string;
  view_count: number;
  created_at: string;
  duration?: number;
  title?: string;
  streamer_username?: string;
}

interface TimelineBucket {
  startDate: Date;
  endDate: Date;
  totalViews: number;
  clipCount: number;
  avgViews: number;
  clips: ClipData[];
  isSpike: boolean;
  isSustained: boolean;
  percentOfMax: number;
}

interface Milestone {
  date: Date;
  label: string;
  position: number; // 0-1 percentage position on timeline
}

interface ClipsTimelineWaveformProps {
  clips: ClipData[];
  onTimeRangeSelect: (startDate: Date, endDate: Date) => void;
  selectedRange?: { from?: Date; to?: Date };
  serverStartDate?: Date;
  milestones?: Milestone[];
  className?: string;
}

interface TooltipData {
  bucket: TimelineBucket;
  x: number;
  y: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Determines optimal bucket size based on the date range
 * For waveform visualization, we want more granular buckets to create smooth waveform
 * - Less than 30 days: daily buckets
 * - 30-90 days: 2-day buckets  
 * - 90-180 days: 3-day buckets
 * - 180-365 days: weekly buckets
 * - 365+ days: bi-weekly buckets
 */
function determineBucketSize(startDate: Date, endDate: Date): 'day' | '2day' | '3day' | 'week' | 'biweek' {
  const diffMs = endDate.getTime() - startDate.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  
  if (diffDays < 30) return 'day';
  if (diffDays < 90) return '2day';
  if (diffDays < 180) return '3day';
  if (diffDays < 365) return 'week';
  return 'biweek';
}

/**
 * Get bucket start date based on bucket type
 */
function getBucketStart(date: Date, bucketType: 'day' | '2day' | '3day' | 'week' | 'biweek'): Date {
  const d = new Date(date);
  
  switch (bucketType) {
    case 'day':
      return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    case '2day': {
      // Align to every 2nd day from epoch
      const daysSinceEpoch = Math.floor(d.getTime() / (24 * 60 * 60 * 1000));
      const alignedDays = Math.floor(daysSinceEpoch / 2) * 2;
      return new Date(alignedDays * 24 * 60 * 60 * 1000);
    }
    case '3day': {
      // Align to every 3rd day from epoch
      const daysSinceEpoch = Math.floor(d.getTime() / (24 * 60 * 60 * 1000));
      const alignedDays = Math.floor(daysSinceEpoch / 3) * 3;
      return new Date(alignedDays * 24 * 60 * 60 * 1000);
    }
    case 'week': {
      const dayOfWeek = d.getUTCDay();
      const diff = d.getUTCDate() - dayOfWeek;
      return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), diff));
    }
    case 'biweek': {
      const weekOfYear = Math.floor((d.getTime() - new Date(Date.UTC(d.getUTCFullYear(), 0, 1)).getTime()) / (7 * 24 * 60 * 60 * 1000));
      const biweekStart = Math.floor(weekOfYear / 2) * 2;
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      return new Date(yearStart.getTime() + biweekStart * 7 * 24 * 60 * 60 * 1000);
    }
  }
}

/**
 * Get bucket end date based on bucket type
 */
function getBucketEnd(startDate: Date, bucketType: 'day' | '2day' | '3day' | 'week' | 'biweek'): Date {
  const d = new Date(startDate);
  
  switch (bucketType) {
    case 'day':
      return new Date(d.getTime() + 24 * 60 * 60 * 1000 - 1);
    case '2day':
      return new Date(d.getTime() + 2 * 24 * 60 * 60 * 1000 - 1);
    case '3day':
      return new Date(d.getTime() + 3 * 24 * 60 * 60 * 1000 - 1);
    case 'week':
      return new Date(d.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
    case 'biweek':
      return new Date(d.getTime() + 14 * 24 * 60 * 60 * 1000 - 1);
  }
}

/**
 * Format date range for display
 */
function formatDateRange(start: Date, end: Date, bucketType: 'day' | '2day' | '3day' | 'week' | 'biweek'): string {
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  const yearOptions: Intl.DateTimeFormatOptions = { ...options, year: 'numeric' };
  
  if (bucketType === 'day') {
    return start.toLocaleDateString('en-US', yearOptions);
  }
  
  const sameMonth = start.getUTCMonth() === end.getUTCMonth();
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  
  if (sameMonth && sameYear) {
    return `${start.toLocaleDateString('en-US', options)} - ${end.getUTCDate()}, ${end.getUTCFullYear()}`;
  }
  
  return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', yearOptions)}`;
}

/**
 * Format view count for display
 */
function formatViews(views: number): string {
  if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`;
  if (views >= 1000) return `${(views / 1000).toFixed(1)}K`;
  return views.toLocaleString();
}

// ═══════════════════════════════════════════════════════════════════════════
// WAVEFORM BAR COMPONENT (DIV-BASED)
// ═══════════════════════════════════════════════════════════════════════════

const WaveformBarDiv = memo(function WaveformBarDiv({
  bucket,
  index,
  totalBars,
  maxHeight,
  isSelected,
  isHovered,
  onHover,
  onClick,
}: {
  bucket: TimelineBucket;
  index: number;
  totalBars: number;
  maxHeight: number;
  isSelected: boolean;
  isHovered: boolean;
  onHover: (bucket: TimelineBucket | null, e: React.MouseEvent | null) => void;
  onClick: (bucket: TimelineBucket) => void;
}) {
  // Calculate bar height
  const baseHeight = bucket.percentOfMax * maxHeight;
  // Add organic variation for empty buckets
  const variation = Math.sin(index * 0.7) * 1.5 + Math.cos(index * 1.3) * 0.8;
  const minHeight = Math.max(3, 4 + variation);
  const barHeight = bucket.clipCount > 0 ? Math.max(8, baseHeight) : minHeight;
  
  // Color based on activity level
  const getBarColor = () => {
    const percent = bucket.percentOfMax;
    
    if (bucket.clipCount === 0 || percent < 0.05) {
      return {
        top: 'rgba(34, 211, 238, 0.3)',
        bottom: 'rgba(6, 182, 212, 0.2)',
      };
    }
    
    if (percent > 0.75) {
      return {
        top: 'rgba(249, 115, 22, 0.95)',
        bottom: 'rgba(234, 88, 12, 0.8)',
      };
    }
    if (percent > 0.5) {
      return {
        top: 'rgba(168, 85, 247, 0.92)',
        bottom: 'rgba(139, 92, 246, 0.75)',
      };
    }
    if (percent > 0.25) {
      return {
        top: 'rgba(99, 102, 241, 0.88)',
        bottom: 'rgba(79, 70, 229, 0.7)',
      };
    }
    return {
      top: 'rgba(34, 211, 238, 0.8)',
      bottom: 'rgba(6, 182, 212, 0.6)',
    };
  };
  
  const colors = getBarColor();
  
  return (
    <motion.div
      initial={{ opacity: 0, scaleY: 0 }}
      animate={{ opacity: 1, scaleY: 1 }}
      transition={{
        delay: index * 0.003,
        duration: 0.3,
        ease: [0.22, 1, 0.36, 1],
      }}
      className="flex flex-col items-center cursor-pointer relative"
      style={{
        flex: '1 1 0',
        minWidth: '2px',
        maxWidth: '12px',
        height: '100%',
      }}
      onMouseEnter={(e) => onHover(bucket, e)}
      onMouseLeave={() => onHover(null, null)}
      onClick={() => onClick(bucket)}
    >
      {/* Top bar (grows upward from center) */}
      <div 
        className="w-full transition-all duration-100 rounded-t-sm"
        style={{
          background: `linear-gradient(to top, ${colors.bottom}, ${colors.top})`,
          height: `${barHeight / 2}px`,
          marginTop: 'auto',
          opacity: isHovered ? 1 : 0.9,
          boxShadow: isHovered ? `0 0 8px ${colors.top}` : 'none',
        }}
      />
      {/* Bottom bar (grows downward from center) */}
      <div 
        className="w-full transition-all duration-100 rounded-b-sm"
        style={{
          background: `linear-gradient(to bottom, ${colors.bottom}, ${colors.top.replace('0.9', '0.6')})`,
          height: `${barHeight / 2}px`,
          marginBottom: 'auto',
          opacity: isHovered ? 0.95 : 0.8,
          boxShadow: isHovered ? `0 0 8px ${colors.bottom}` : 'none',
        }}
      />
      {/* Selection indicator */}
      {isSelected && (
        <div 
          className="absolute inset-0 rounded-sm pointer-events-none"
          style={{
            border: '1px solid rgba(168, 85, 247, 0.6)',
            boxShadow: '0 0 8px rgba(168, 85, 247, 0.4)',
          }}
        />
      )}
      {/* Hover highlight */}
      {isHovered && (
        <div 
          className="absolute inset-0 rounded-sm pointer-events-none"
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
          }}
        />
      )}
    </motion.div>
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// TOOLTIP COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const WaveformTooltip = memo(function WaveformTooltip({
  data,
  bucketType,
}: {
  data: TooltipData | null;
  bucketType: 'day' | '2day' | '3day' | 'week' | 'biweek';
}) {
  if (!data) return null;
  
  const { bucket, x, y } = data;
  
  const getTrendIcon = () => {
    if (bucket.isSpike) return <TrendingUp className="h-3.5 w-3.5 text-orange-400" />;
    if (bucket.isSustained) return <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />;
    if (bucket.percentOfMax < 0.2) return <TrendingDown className="h-3.5 w-3.5 text-gray-400" />;
    return <Minus className="h-3.5 w-3.5 text-cyan-400" />;
  };
  
  const getTrendLabel = () => {
    if (bucket.isSpike) return 'Spike in Activity';
    if (bucket.isSustained) return 'Sustained Interest';
    if (bucket.percentOfMax < 0.2) return 'Low Activity';
    return 'Normal Activity';
  };
  
  const getTrendColor = () => {
    if (bucket.isSpike) return 'text-orange-400';
    if (bucket.isSustained) return 'text-emerald-400';
    if (bucket.percentOfMax < 0.2) return 'text-gray-400';
    return 'text-cyan-400';
  };
  
  // Position tooltip below the waveform, centered on the hovered bar
  // Calculate position to stay within viewport bounds
  const tooltipWidth = 220;
  const leftPos = Math.min(Math.max(x - tooltipWidth / 2, 10), (typeof window !== 'undefined' ? window.innerWidth : 1200) - tooltipWidth - 20);
  
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -5, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -5, scale: 0.95 }}
        transition={{ duration: 0.12 }}
        className="absolute z-50 pointer-events-none"
        style={{
          left: leftPos,
          bottom: -10, // Position below the waveform
          transform: 'translateY(100%)',
        }}
      >
        <div 
          className="px-3 py-2.5 rounded-lg shadow-2xl border min-w-[200px]"
          style={{
            background: 'linear-gradient(135deg, rgba(18, 18, 21, 0.98) 0%, rgba(24, 24, 27, 0.98) 100%)',
            borderColor: 'rgba(168, 85, 247, 0.3)',
            backdropFilter: 'blur(16px)',
          }}
        >
          {/* Compact layout - Date and stats on same row */}
          <div className="flex items-center justify-between gap-4 mb-1.5">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3 w-3 text-purple-400" />
              <span className="text-xs text-white font-medium">
                {formatDateRange(bucket.startDate, bucket.endDate, bucketType)}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <Eye className="h-3 w-3 text-cyan-400/70" />
                <span className="text-sm font-bold text-cyan-400">{formatViews(bucket.totalViews)}</span>
              </div>
              <div className="flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-purple-400/70" />
                <span className="text-sm font-bold text-purple-400">{bucket.clipCount}</span>
              </div>
            </div>
          </div>
          
          {/* Trend indicator and click hint */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {getTrendIcon()}
              <span className={cn("text-[11px] font-medium", getTrendColor())}>
                {getTrendLabel()}
              </span>
            </div>
            <span className="text-[10px] text-gray-500">Click to filter</span>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// MILESTONE LABEL COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const MilestoneLabel = memo(function MilestoneLabel({
  milestone,
  totalWidth,
}: {
  milestone: Milestone;
  totalWidth: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, duration: 0.3 }}
      className="absolute flex flex-col items-center"
      style={{
        left: `${milestone.position * 100}%`,
        transform: 'translateX(-50%)',
      }}
    >
      {/* Vertical dashed line */}
      <div 
        className="w-px h-6"
        style={{
          background: 'linear-gradient(to bottom, rgba(168, 85, 247, 0.4), transparent)',
        }}
      />
      {/* Label */}
      <div 
        className="px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap mt-1"
        style={{
          background: 'rgba(168, 85, 247, 0.15)',
          border: '1px solid rgba(168, 85, 247, 0.25)',
          color: '#c4b5fd',
        }}
      >
        {milestone.label}
      </div>
      {/* Date */}
      <span className="text-[10px] text-gray-500 mt-0.5">
        {milestone.date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
      </span>
    </motion.div>
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// MAIN WAVEFORM COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const ClipsTimelineWaveform = memo(function ClipsTimelineWaveform({
  clips,
  onTimeRangeSelect,
  selectedRange,
  serverStartDate,
  milestones = [],
  className,
}: ClipsTimelineWaveformProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredBucket, setHoveredBucket] = useState<TooltipData | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  
  // Update container width on resize
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };
    
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);
  
  // Target number of bars for smooth waveform appearance
  const TARGET_BARS = 100;
  
  // Calculate timeline bounds and buckets
  const { buckets, bucketType, timelineStart, timelineEnd, maxViews } = useMemo(() => {
    if (!clips || clips.length === 0) {
      return { buckets: [], bucketType: 'day' as const, timelineStart: new Date(), timelineEnd: new Date(), maxViews: 0 };
    }
    
    // Find date range from clips
    const dates = clips.map(c => new Date(c.created_at).getTime());
    const minDate = serverStartDate || new Date(Math.min(...dates));
    const maxDate = new Date(); // Always extend to present
    
    // Calculate bucket duration to achieve target number of bars
    const totalDuration = maxDate.getTime() - minDate.getTime();
    const bucketDuration = totalDuration / TARGET_BARS;
    
    // Determine display bucket type based on duration for formatting
    const dayMs = 24 * 60 * 60 * 1000;
    let bucketSize: 'day' | '2day' | '3day' | 'week' | 'biweek';
    if (bucketDuration < dayMs * 1.5) {
      bucketSize = 'day';
    } else if (bucketDuration < dayMs * 2.5) {
      bucketSize = '2day';
    } else if (bucketDuration < dayMs * 5) {
      bucketSize = '3day';
    } else if (bucketDuration < dayMs * 10) {
      bucketSize = 'week';
    } else {
      bucketSize = 'biweek';
    }
    
    // Create fixed number of buckets for smooth waveform
    const bucketsArray: TimelineBucket[] = [];
    
    for (let i = 0; i < TARGET_BARS; i++) {
      const bucketStart = new Date(minDate.getTime() + (i * bucketDuration));
      const bucketEnd = new Date(minDate.getTime() + ((i + 1) * bucketDuration) - 1);
      
      bucketsArray.push({
        startDate: bucketStart,
        endDate: bucketEnd,
        totalViews: 0,
        clipCount: 0,
        avgViews: 0,
        clips: [],
        isSpike: false,
        isSustained: false,
        percentOfMax: 0,
      });
    }
    
    // Distribute clips into buckets
    for (const clip of clips) {
      const clipTime = new Date(clip.created_at).getTime();
      const bucketIndex = Math.min(
        Math.floor((clipTime - minDate.getTime()) / bucketDuration),
        TARGET_BARS - 1
      );
      
      if (bucketIndex >= 0 && bucketIndex < bucketsArray.length) {
        const bucket = bucketsArray[bucketIndex];
        bucket.clips.push(clip);
        bucket.totalViews += clip.view_count;
        bucket.clipCount += 1;
      }
    }
    
    // Calculate averages and find max
    let maxTotalViews = 0;
    for (const bucket of bucketsArray) {
      if (bucket.clipCount > 0) {
        bucket.avgViews = Math.round(bucket.totalViews / bucket.clipCount);
      }
      maxTotalViews = Math.max(maxTotalViews, bucket.totalViews);
    }
    
    // Calculate percentages and detect spikes/sustained interest
    for (let i = 0; i < bucketsArray.length; i++) {
      const bucket = bucketsArray[i];
      bucket.percentOfMax = maxTotalViews > 0 ? bucket.totalViews / maxTotalViews : 0;
      
      // Check for spike (significantly higher than neighbors)
      if (i > 0 && i < bucketsArray.length - 1) {
        const prevViews = bucketsArray[i - 1].totalViews;
        const nextViews = bucketsArray[i + 1].totalViews;
        const avgNeighbors = (prevViews + nextViews) / 2;
        
        if (avgNeighbors > 0 && bucket.totalViews > avgNeighbors * 2.5) {
          bucket.isSpike = true;
        }
      }
      
      // Check for sustained interest (high for multiple consecutive buckets)
      if (i >= 2 && bucket.percentOfMax > 0.4) {
        const prev1 = bucketsArray[i - 1];
        const prev2 = bucketsArray[i - 2];
        if (prev1.percentOfMax > 0.3 && prev2.percentOfMax > 0.3) {
          bucket.isSustained = true;
          prev1.isSustained = true;
        }
      }
    }
    
    return {
      buckets: bucketsArray,
      bucketType: bucketSize,
      timelineStart: minDate,
      timelineEnd: maxDate,
      maxViews: maxTotalViews,
    };
  }, [clips, serverStartDate]);
  
  // Calculate milestone positions
  const processedMilestones = useMemo(() => {
    if (!milestones.length || !timelineStart || !timelineEnd) return [];
    
    const totalTime = timelineEnd.getTime() - timelineStart.getTime();
    
    return milestones
      .filter(m => m.date >= timelineStart && m.date <= timelineEnd)
      .map(m => ({
        ...m,
        position: (m.date.getTime() - timelineStart.getTime()) / totalTime,
      }));
  }, [milestones, timelineStart, timelineEnd]);
  
  // Check if a bucket is within the selected range
  const isBucketSelected = useCallback((bucket: TimelineBucket) => {
    if (!selectedRange?.from && !selectedRange?.to) return false;
    
    const rangeStart = selectedRange.from?.getTime() ?? 0;
    const rangeEnd = selectedRange.to?.getTime() ?? Infinity;
    
    return bucket.startDate.getTime() >= rangeStart && bucket.endDate.getTime() <= rangeEnd;
  }, [selectedRange]);
  
  // Handle hover
  const handleHover = useCallback((bucket: TimelineBucket | null, e: React.MouseEvent | null) => {
    if (!bucket || !e || !containerRef.current) {
      setHoveredBucket(null);
      return;
    }
    
    const rect = containerRef.current.getBoundingClientRect();
    setHoveredBucket({
      bucket,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  }, []);
  
  // Handle click to select range
  const handleClick = useCallback((bucket: TimelineBucket) => {
    onTimeRangeSelect(bucket.startDate, bucket.endDate);
  }, [onTimeRangeSelect]);
  
  // Don't render if no clips
  if (!clips || clips.length === 0) {
    return null;
  }
  
  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={cn("relative", className)}
    >
      <Card variant="elevated" className="overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl">
          <div 
            className="absolute inset-0 opacity-30"
            style={{
              background: 'radial-gradient(ellipse at center, rgba(168, 85, 247, 0.08) 0%, transparent 70%)',
            }}
          />
        </div>
        
        <CardContent className="p-4 md:p-6 relative z-10">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-purple-400" />
              <h3 className="text-sm font-medium text-white">Viewership Timeline</h3>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-cyan-400/70" />
                Low
              </span>
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-purple-400/80" />
                Medium
              </span>
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-orange-400/90" />
                High
              </span>
            </div>
          </div>
          
          {/* Waveform - Div-based for reliable rendering */}
          <div className="relative">
            {/* Center line */}
            <div 
              className="absolute left-0 right-0 h-px top-1/2 -translate-y-1/2"
              style={{ background: 'rgba(168, 85, 247, 0.2)' }}
            />
            
            {/* Waveform bars container */}
            <div className="flex items-center justify-center h-[120px] gap-[1px]">
              {buckets.map((bucket, index) => (
                <WaveformBarDiv
                  key={bucket.startDate.toISOString()}
                  bucket={bucket}
                  index={index}
                  totalBars={buckets.length}
                  maxHeight={110}
                  isSelected={isBucketSelected(bucket)}
                  isHovered={hoveredBucket?.bucket === bucket}
                  onHover={handleHover}
                  onClick={handleClick}
                />
              ))}
            </div>
            
            {/* Tooltip */}
            <WaveformTooltip data={hoveredBucket} bucketType={bucketType} />
          </div>
          
          {/* Date range labels */}
          <div className="flex justify-between items-center mt-3 text-xs text-gray-500">
            <span>{timelineStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
            <span>Present</span>
          </div>
          
          {/* Milestones */}
          {processedMilestones.length > 0 && (
            <div className="relative h-16 mt-4 -mb-2">
              {processedMilestones.map((milestone, index) => (
                <MilestoneLabel
                  key={`${milestone.label}-${index}`}
                  milestone={milestone}
                  totalWidth={containerWidth}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
});

export default ClipsTimelineWaveform;

"use client"

import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { type PlayerCountData, StreamCountData, ViewerCountData, ServerCapacityData, getServerStats, getStreamerStats, getViewerStats, calculateTimeAtMaxCapacity } from "@/lib/data"
import { Users, Twitch, TrendingUp, Wifi, WifiOff, Gauge, AlertCircle, Sparkles, Activity, Film } from 'lucide-react'
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { motion, AnimatePresence } from "motion/react"
import { AnimatedNumber, PulseIndicator } from "@/components/ui/motion"
import { cardHover, springs } from "@/lib/motion"
import { type LiveServerData } from "@/hooks/use-live-server-data"
import { type RestartPrediction } from "@/lib/restart-prediction"
import { RestartCountdown } from "@/components/restart-countdown"
import { memo } from "react"
import { useFeatureFlag, FEATURE_FLAGS } from "@/lib/feature-flags"
import { CapacityAdvisorCard } from "@/components/capacity-advisor-card"
import { ServerAnomaliesCard } from "@/components/server-anomalies-card"

// Kick icon component (they don't have an official icon in lucide)
function KickIcon({ className }: { className?: string }) {
  return (
    <svg 
      viewBox="0 0 24 24" 
      fill="#00e701" 
      className={className}
    >
      <path d="M1.333 0v24h21.334V0H1.333zm17.12 18.347h-4.32l-3.093-4.907-1.653 1.76v3.147H5.654V5.653h3.733v5.28l4.48-5.28h4.427l-4.907 5.44 4.986 7.254h.08z"/>
    </svg>
  );
}

function QueueIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`h-4 w-4 ${className ?? ''}`}
    >
      {/* Three users in a line representing queue - front to back with decreasing opacity */}
      {/* Front user (full opacity) */}
      <circle cx="6" cy="8" r="2.5" fill="currentColor" />
      <path d="M2 16c0-2.2 1.8-4 4-4s4 1.8 4 4" fill="currentColor" />
      {/* Middle user (medium opacity) */}
      <g opacity="0.6">
        <circle cx="12" cy="8" r="2.5" fill="currentColor" />
        <path d="M8 16c0-2.2 1.8-4 4-4s4 1.8 4 4" fill="currentColor" />
      </g>
      {/* Back user (low opacity) */}
      <g opacity="0.35">
        <circle cx="18" cy="8" r="2.5" fill="currentColor" />
        <path d="M14 16c0-2.2 1.8-4 4-4s4 1.8 4 4" fill="currentColor" />
      </g>
    </svg>
  )
}

// Animated background gradient for cards
const CardGradientBackground = memo(function CardGradientBackground() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl">
      {/* Rotating gradient orb */}
      <motion.div
        className="absolute -top-1/2 -right-1/2 w-full h-full rounded-full blur-3xl opacity-30"
        style={{ 
          background: 'radial-gradient(circle, rgba(0, 217, 255, 0.15) 0%, transparent 70%)' 
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
      />
      {/* Grid pattern overlay */}
      <div 
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0, 217, 255, 0.5) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 217, 255, 0.5) 1px, transparent 1px)
          `,
          backgroundSize: '30px 30px',
        }}
      />
    </div>
  )
})

// Stat item component with consistent styling
const StatItem = memo(function StatItem({ 
  label, 
  value, 
  icon: Icon, 
  icons,
  isLive = false, 
  loading = false,
  suffix,
  subtext,
  color = "white",
  delay = 0
}: { 
  label: string
  value: number
  icon?: React.ComponentType<{ className?: string }>
  icons?: React.ComponentType<{ className?: string }>[]
  isLive?: boolean
  loading?: boolean
  suffix?: React.ReactNode
  subtext?: string
  color?: "white" | "green" | "purple" | "cyan"
  delay?: number
}) {
  const colorClasses = {
    white: "text-white",
    green: "text-emerald-400",
    purple: "text-purple-400",
    cyan: "text-cyan-400",
  }
  
  return (
    <motion.div 
      className="flex flex-col relative group"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay * 0.05, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Hover glow effect */}
      <div className="absolute -inset-2 bg-cyan-500/5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-sm" />
      
      <span className="text-xs text-gray-400 flex items-center gap-1.5 relative">
        {icons ? (
          <div className="flex items-center gap-1">
            {icons.map((IconComponent, idx) => (
              <IconComponent key={idx} className="h-3 w-3 text-cyan-400/70" />
            ))}
          </div>
        ) : Icon ? (
          <Icon className="h-3 w-3 text-cyan-400/70" />
        ) : null}
        {label}
        {isLive && (
          <motion.span 
            className="text-emerald-400 text-[10px] flex items-center gap-0.5"
            animate={{ opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          </motion.span>
        )}
      </span>
      <div className="flex items-baseline gap-1.5 min-h-[28px] relative">
        {loading ? (
          <span className="text-xl font-bold text-white">-</span>
        ) : (
          <AnimatedNumber 
            value={value} 
            className={`text-xl font-bold ${colorClasses[color]}`} 
          />
        )}
        {suffix}
      </div>
      {subtext && (
        <span className="text-[10px] text-gray-500 mt-0.5">{subtext}</span>
      )}
    </motion.div>
  )
})

interface ServerStatsCardsProps {
  // Historical data (from Supabase) - used for peak/average calculations
  playerData: PlayerCountData[]
  capacityData: ServerCapacityData[]
  streamerData: StreamCountData[]
  viewerData: ViewerCountData[]
  // Server identification
  serverId: string
  serverName: string
  loading: boolean
  // Live data (from direct API calls) - used for current values
  liveData?: LiveServerData | null
  liveLoading?: boolean
  // Restart prediction data
  restartPrediction?: RestartPrediction | null
  // Callback for viewing server changes
  onViewChanges?: () => void
}


export default function ServerStatsCards({ 
  playerData, 
  capacityData, 
  streamerData, 
  viewerData, 
  serverId, 
  serverName, 
  loading,
  liveData,
  liveLoading = false,
  restartPrediction,
  onViewChanges
}: ServerStatsCardsProps) {
  // Feature flags
  const showStreamsButton = useFeatureFlag(FEATURE_FLAGS.SERVER_CARD_STREAMS);
  const showClipsButton = useFeatureFlag(FEATURE_FLAGS.SERVER_CARD_CLIPS);
  const showChangesButton = useFeatureFlag(FEATURE_FLAGS.SERVER_CARD_CHANGES);
  const showRestartCountdown = useFeatureFlag(FEATURE_FLAGS.SERVER_CARD_RESTART);
  const showCapacityIndicator = useFeatureFlag(FEATURE_FLAGS.SERVER_CARD_CAPACITY);
  
  // Historical stats (peak/average from Supabase data)
  const { peak: historicalPeak, average: historicalAverage } = getServerStats(playerData, serverId)
  const { streamPeak, streamAverage } = getStreamerStats(streamerData, serverId)
  const { viewerPeak, viewerAverage } = getViewerStats(viewerData, serverId)
  
  // Live data values (current from direct API) - NO DATABASE FALLBACK
  // Current values MUST come from live APIs to ensure accuracy
  const hasLiveFiveMData = !!liveData?.fivem
  const hasLiveTwitchData = !!liveData?.twitch
  const hasLiveKickData = !!liveData?.kick
  const hasLiveData = hasLiveFiveMData || hasLiveTwitchData || hasLiveKickData
  
  // Current values - ONLY from live API, no database fallback
  const currentPlayers = liveData?.fivem?.currentPlayers ?? 0
  const liveMaxCapacity = liveData?.fivem?.maxCapacity ?? 0
  // Aggregate streams and viewers from both Twitch and Kick platforms
  const twitchStreams = liveData?.twitch?.streamCount ?? 0
  const kickStreams = liveData?.kick?.streamCount ?? 0
  const currentStreams = twitchStreams + kickStreams
  const twitchViewers = liveData?.twitch?.viewerCount ?? 0
  const kickViewers = liveData?.kick?.viewerCount ?? 0
  const currentViewers = twitchViewers + kickViewers
  const isOnline = liveData?.fivem?.online ?? false
  const queueData = liveData?.queue ?? null
  const hasQueueInfo = !!(queueData && !queueData.error)
  const queueSegments = queueData?.segments ?? []
  const queuePrimarySegment = queueSegments.find(segment => segment.type === "public") || queueSegments[0]
  const queuePrimaryPlayers = queuePrimarySegment ? queuePrimarySegment.players : queueData?.totalPlayers ?? 0
  const queuePrimaryLabel = queuePrimarySegment?.label ?? "Queue"
  // For Free2RP, only show in_queue. For ChaseRP, show public/allowlist
  const prioritizedQueueSegments = queueSegments.filter(segment => 
    segment.type === "public" || segment.type === "allowlist" || segment.type === "in_queue"
  )
  let queueSegmentsToDisplay = (prioritizedQueueSegments.length > 0 ? prioritizedQueueSegments : queueSegments).slice(0, 2)
  if (queueSegmentsToDisplay.length === 0 && queuePrimarySegment) {
    queueSegmentsToDisplay = [queuePrimarySegment]
  }
  
  // Get latest max capacity - prefer live data
  const latestCapacity = hasLiveData && liveMaxCapacity > 0 
    ? liveMaxCapacity 
    : capacityData
        .filter(d => d.server_id === serverId)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]?.max_capacity || null
  
  // Calculate % time at max capacity (historical data only)
  const timeAtMaxPercent = calculateTimeAtMaxCapacity(playerData, capacityData, serverId)

  // Calculate current capacity percentage (bounded 0-100%)
  const currentCapacityPercent = latestCapacity && latestCapacity > 0 
    ? Math.min(Math.max(Math.round((currentPlayers / latestCapacity) * 100), 0), 100)
    : 0

  // Determine capacity color based on percentage
  const getCapacityColor = (percent: number) => {
    if (percent >= 100) return 'text-red-400'
    if (percent >= 80) return 'text-orange-400'
    if (percent >= 60) return 'text-yellow-400'
    return 'text-emerald-400'
  }

  const getCapacityGlow = (percent: number) => {
    if (percent >= 100) return 'shadow-red-500/30'
    if (percent >= 80) return 'shadow-orange-500/30'
    if (percent >= 60) return 'shadow-yellow-500/30'
    return 'shadow-emerald-500/30'
  }

  const getQueueGlow = () => 'shadow-cyan-500/30'

  // Determine if we're showing live or historical current data
  const isShowingLiveData = hasLiveData && !liveLoading

  const currentPlayerSuffix = latestCapacity ? (
    <div className="flex items-center gap-1 text-xs text-gray-500">
      <span>/ {latestCapacity}</span>
    </div>
  ) : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={springs.smooth}
      className="group"
    >
      <Card className="col-span-1 overflow-hidden relative" variant="elevated">
        <CardGradientBackground />
        
        {/* Header */}
        <CardHeader className="pb-3 relative z-10">
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1, ...springs.snappy }}
            className="flex items-center justify-between gap-2 flex-nowrap"
          >
            <div className="flex items-center gap-3 min-w-0">
              {/* Server status indicator */}
              <motion.div
                className={`w-2 h-2 rounded-full flex-shrink-0 ${isOnline ? 'bg-emerald-400' : 'bg-gray-500'}`}
                animate={isOnline ? { 
                  scale: [1, 1.2, 1],
                  opacity: [1, 0.7, 1]
                } : {}}
                transition={{ duration: 2, repeat: Infinity }}
                style={{
                  boxShadow: isOnline ? '0 0 10px rgba(52, 211, 153, 0.5)' : 'none'
                }}
              />
              
              <CardTitle className="text-base font-bold text-white flex items-center gap-2 min-w-0">
                <span className="bg-gradient-to-r from-white to-cyan-100 bg-clip-text text-transparent truncate">
                  {serverName}
                </span>
                {/* Loading indicator for live data */}
                {liveLoading && (
                  <motion.span
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="text-xs text-cyan-400/70 flex items-center gap-1 flex-shrink-0"
                  >
                    <Activity className="h-3 w-3" />
                    updating
                  </motion.span>
                )}
              </CardTitle>
            </div>
            
            <div className="flex items-center gap-2 flex-nowrap">
              {/* Restart Countdown - positioned between server name and metrics */}
              {showRestartCountdown && (
                <div className="flex-shrink-0">
                  <RestartCountdown prediction={restartPrediction || null} />
                </div>
              )}

              {/* Queue indicator */}
              {hasQueueInfo && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.25, ...springs.snappy }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border backdrop-blur-sm shadow-lg flex-shrink-0 ${getQueueGlow()}`}
                  style={{
                    background: 'linear-gradient(135deg, rgba(24, 24, 27, 0.9) 0%, rgba(18, 18, 21, 0.9) 100%)',
                    borderColor: 'rgba(0, 217, 255, 0.2)'
                  }}
                >
                  <QueueIcon className="text-gray-200" />
                  <div className="flex items-center gap-3">
                    {queueSegmentsToDisplay.map(segment => (
                      <div key={segment.type} className="flex flex-col items-end">
                        <span className="text-sm font-bold text-gray-200">
                          {segment.players}
                        </span>
                        <span className="text-[9px] text-gray-400 -mt-0.5">
                          {segment.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
              
              {/* Current Capacity indicator - shows on every card */}
              {showCapacityIndicator && latestCapacity && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2, ...springs.snappy }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border backdrop-blur-sm shadow-lg flex-shrink-0 ${getCapacityGlow(currentCapacityPercent)}`}
                  style={{
                    background: 'linear-gradient(135deg, rgba(24, 24, 27, 0.9) 0%, rgba(18, 18, 21, 0.9) 100%)',
                    borderColor: currentCapacityPercent >= 100 
                      ? 'rgba(239, 68, 68, 0.3)' 
                      : currentCapacityPercent >= 80 
                        ? 'rgba(249, 115, 22, 0.3)'
                        : 'rgba(0, 217, 255, 0.2)'
                  }}
                >
                  {/* Capacity indicator - shows if currently at max */}
                  {currentPlayers >= latestCapacity ? (
                    <motion.span
                      animate={{ 
                        scale: [1, 1.2, 1],
                        opacity: [0.8, 1, 0.8]
                      }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="text-red-400"
                    >
                      <AlertCircle className="h-3.5 w-3.5" />
                    </motion.span>
                  ) : (
                    <Gauge className={`h-3.5 w-3.5 ${getCapacityColor(currentCapacityPercent)}`} />
                  )}
                  <div className="flex flex-col items-end">
                    <span className={`text-sm font-bold ${getCapacityColor(currentCapacityPercent)}`}>
                      {currentCapacityPercent}%
                    </span>
                    <span className="text-[9px] text-gray-500 -mt-0.5">capacity</span>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        </CardHeader>
        
        {/* Stats Grid */}
        <CardContent className="grid grid-cols-3 gap-4 pt-2 relative z-10">
          {/* Row 1: Player Stats */}
          <StatItem 
            label="Current" 
            value={currentPlayers} 
            icon={Users}
            isLive={isShowingLiveData}
            loading={loading && !hasLiveData}
            color={isShowingLiveData ? "green" : "white"}
            suffix={currentPlayerSuffix}
            delay={0}
          />
          <StatItem 
            label="Peak" 
            value={historicalPeak}
            loading={loading}
            delay={1}
          />
          <StatItem 
            label="Average" 
            value={historicalAverage}
            loading={loading}
            delay={2}
          />
          
          {/* Row 2: Stream Stats */}
          <StatItem 
            label="Streams" 
            value={currentStreams}
            icons={[Twitch, KickIcon]}
            isLive={isShowingLiveData}
            loading={loading && !hasLiveData}
            color={isShowingLiveData ? "purple" : "white"}
            delay={3}
          />
          <StatItem 
            label="Peak Streams" 
            value={streamPeak}
            loading={loading}
            delay={4}
          />
          <StatItem 
            label="Avg Streams" 
            value={streamAverage}
            loading={loading}
            delay={5}
          />
          
          {/* Row 3: Viewer Stats */}
          <StatItem 
            label="Viewers" 
            value={currentViewers}
            icons={[Twitch, KickIcon]}
            isLive={isShowingLiveData}
            loading={loading && !hasLiveData}
            color={isShowingLiveData ? "purple" : "white"}
            delay={6}
          />
          <StatItem 
            label="Peak Viewers" 
            value={viewerPeak}
            loading={loading}
            delay={7}
          />
          <StatItem 
            label="Avg Viewers" 
            value={viewerAverage}
            loading={loading}
            delay={8}
          />
        </CardContent>
        
        {/* Capacity Advisor — "best time to join" (R8). Self-gated fail-closed
            behind the `capacity_advisor` flag; renders nothing when disabled. */}
        <div className="px-6 pb-2 relative z-10">
          <CapacityAdvisorCard serverId={serverId} serverName={serverName} />
        </div>

        {/* Public anomaly surface (R7.5). Self-gated fail-closed behind the
            `anomaly_public` flag; renders nothing when disabled or when there
            are no active anomalies, so the surface is unchanged in the common
            case. */}
        <div className="px-6 pb-2 relative z-10">
          <ServerAnomaliesCard serverId={serverId} serverName={serverName} />
        </div>
        
        {/* Footer */}
        <CardFooter className="pt-3 pb-4 flex items-center gap-2 relative z-10">
          {showStreamsButton && (
            <Link href={`/streams/${serverId}`} className="flex-1">
              <motion.button
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-300 border backdrop-blur-sm"
                style={{
                  background: 'linear-gradient(135deg, rgba(24, 24, 27, 0.9) 0%, rgba(18, 18, 21, 0.9) 100%)',
                  borderColor: 'rgba(0, 217, 255, 0.15)',
                }}
                whileHover={{ 
                  borderColor: 'rgba(0, 217, 255, 0.4)',
                  boxShadow: '0 0 15px rgba(0, 217, 255, 0.1)'
                }}
                whileTap={{ scale: 0.98 }}
              >
                <motion.div
                  className="flex items-center gap-1"
                  animate={{ 
                    opacity: currentStreams > 0 ? [1, 0.6, 1] : 1
                  }}
                  transition={{ 
                    duration: 2, 
                    repeat: currentStreams > 0 ? Infinity : 0,
                    ease: "easeInOut"
                  }}
                >
                  {hasLiveTwitchData && (
                    <Twitch className="h-3.5 w-3.5 text-purple-400" />
                  )}
                  {hasLiveKickData && (
                    <KickIcon className="h-3.5 w-3.5" style={{ color: '#53FC18' }} />
                  )}
                  {!hasLiveTwitchData && !hasLiveKickData && (
                    <Twitch className="h-3.5 w-3.5 text-purple-400" />
                  )}
                </motion.div>
                <span className="text-white">Streams</span>
                <motion.span 
                  className="inline-flex items-center justify-center bg-cyan-500/20 text-cyan-400 rounded-full h-4 min-w-4 px-1 text-[10px] font-bold border border-cyan-500/30"
                  key={currentStreams}
                  initial={{ scale: 1.2 }}
                  animate={{ scale: 1 }}
                  transition={springs.bouncy}
                >
                  {currentStreams}
                </motion.span>
              </motion.button>
            </Link>
          )}
          
          {showClipsButton && (
            <Link href={`/clips/${serverId}`} className="flex-1">
              <motion.button
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-300 border backdrop-blur-sm"
                style={{
                  background: 'linear-gradient(135deg, rgba(24, 24, 27, 0.9) 0%, rgba(18, 18, 21, 0.9) 100%)',
                  borderColor: 'rgba(0, 217, 255, 0.15)',
                }}
                whileHover={{ 
                  borderColor: 'rgba(0, 217, 255, 0.4)',
                  boxShadow: '0 0 15px rgba(0, 217, 255, 0.1)'
                }}
                whileTap={{ scale: 0.98 }}
              >
                <Film className="h-3.5 w-3.5 text-purple-400" />
                <span className="text-white">Clips</span>
              </motion.button>
            </Link>
          )}
          
          {showChangesButton && onViewChanges && (
            <motion.button 
              onClick={onViewChanges}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-300 border backdrop-blur-sm text-white"
              style={{
                background: 'linear-gradient(135deg, rgba(24, 24, 27, 0.9) 0%, rgba(18, 18, 21, 0.9) 100%)',
                borderColor: 'rgba(0, 217, 255, 0.15)',
              }}
              whileHover={{ 
                borderColor: 'rgba(0, 217, 255, 0.4)',
                boxShadow: '0 0 15px rgba(0, 217, 255, 0.1)'
              }}
              whileTap={{ scale: 0.98 }}
            >
              <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
              Changes
            </motion.button>
          )}
        </CardFooter>
      </Card>
    </motion.div>
  )
}

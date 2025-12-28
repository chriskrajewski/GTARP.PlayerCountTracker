"use client"

import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { type PlayerCountData, StreamCountData, ViewerCountData, ServerCapacityData, getServerStats, getStreamerStats, getViewerStats, calculateTimeAtMaxCapacity } from "@/lib/data"
import { Users, Twitch, TrendingUp, Wifi, WifiOff, Radio, Gauge, AlertCircle } from 'lucide-react'
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { motion } from "motion/react"
import { AnimatedNumber, PulseIndicator } from "@/components/ui/motion"
import { cardHover, springs } from "@/lib/motion"
import { type LiveServerData } from "@/hooks/use-live-server-data"

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
  onViewChanges
}: ServerStatsCardsProps) {
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
    return 'text-green-400'
  }

  // Animation variants for stat items
  const statItemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: i * 0.05,
        duration: 0.3,
        ease: [0.22, 1, 0.36, 1]
      }
    })
  }

  // Determine if we're showing live or historical current data
  const isShowingLiveData = hasLiveData && !liveLoading

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={springs.smooth}
      whileHover={cardHover.whileHover}
      style={{ willChange: "transform, box-shadow" }}
    >
      <Card className="col-span-1 bg-gray-800 border-gray-700 overflow-hidden">
        <CardHeader className="pb-2 border-b border-gray-700">
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1, ...springs.snappy }}
            className="flex items-center justify-between gap-3"
          >
            <CardTitle className="text-lg font-medium text-white flex items-center gap-2">
              {serverName}
              {/* Loading indicator for live data */}
              {liveLoading && (
                <motion.span
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="text-xs text-gray-400"
                >
                  updating...
                </motion.span>
              )}
            </CardTitle>
            
            {/* Current Capacity indicator - shows on every card */}
            {latestCapacity && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2, ...springs.snappy }}
                className="flex items-center gap-1.5 px-2 py-1 bg-[#18181b] rounded-md border border-[#26262c]"
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
                    <AlertCircle className="h-3 w-3" />
                  </motion.span>
                ) : (
                  <Gauge className={`h-3 w-3 ${getCapacityColor(currentCapacityPercent)}`} />
                )}
                <span className="text-[10px] text-gray-400 whitespace-nowrap">
                  Capacity
                </span>
                <span className={`text-xs font-semibold ${getCapacityColor(currentCapacityPercent)}`}>
                  {currentCapacityPercent}%
                </span>
              </motion.div>
            )}
          </motion.div>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-4 pt-4">
          {/* Current Players - LIVE DATA */}
          <motion.div 
            className="flex flex-col"
            variants={statItemVariants}
            initial="hidden"
            animate="visible"
            custom={0}
          >
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Users className="h-3 w-3" /> Current Players
              {isShowingLiveData && (
                <motion.span 
                  className="text-green-400 text-[10px]"
                  animate={{ opacity: [0.7, 1, 0.7] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  ●
                </motion.span>
              )}
            </span>
            <div className="flex items-baseline gap-1 min-h-[28px]">
              {loading && !hasLiveData ? (
                <span className="text-xl font-bold text-white">-</span>
              ) : (
                <AnimatedNumber 
                  value={currentPlayers} 
                  className={`text-xl font-bold ${isShowingLiveData ? 'text-green-400' : 'text-white'}`} 
                />
              )}
              {latestCapacity && (
                <span className="text-sm text-gray-400">/ {latestCapacity}</span>
              )}
            </div>
          </motion.div>

          {/* Peak Players - HISTORICAL DATA */}
          <motion.div 
            className="flex flex-col"
            variants={statItemVariants}
            initial="hidden"
            animate="visible"
            custom={1}
          >
            <span className="text-xs text-gray-400">Peak Players</span>
            <div className="min-h-[28px] flex items-center">
              {loading ? (
                <span className="text-xl font-bold text-white">-</span>
              ) : (
                <AnimatedNumber value={historicalPeak} className="text-xl font-bold text-white" />
              )}
            </div>
          </motion.div>

          {/* Average Players - HISTORICAL DATA */}
          <motion.div 
            className="flex flex-col"
            variants={statItemVariants}
            initial="hidden"
            animate="visible"
            custom={2}
          >
            <span className="text-xs text-gray-400">Average Players</span>
            <div className="min-h-[28px] flex items-center">
              {loading ? (
                <span className="text-xl font-bold text-white">-</span>
              ) : (
                <AnimatedNumber value={historicalAverage} className="text-xl font-bold text-white" />
              )}
            </div>
          </motion.div>
          
          {/* Current Streams - LIVE DATA */}
          <motion.div 
            className="flex flex-col"
            variants={statItemVariants}
            initial="hidden"
            animate="visible"
            custom={3}
          >
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <div className="flex items-center gap-1">
                <Twitch className="h-3 w-3 text-purple-400" />
                {(hasLiveTwitchData && hasLiveKickData) && (
                  <KickIcon className="h-3 w-3" style={{ color: '#53FC18' }} />
                )}
                {!hasLiveTwitchData && hasLiveKickData && (
                  <KickIcon className="h-3 w-3" style={{ color: '#53FC18' }} />
                )}
              </div>
              Current Streams
              {isShowingLiveData && (
                <motion.span 
                  className="text-green-400 text-[10px]"
                  animate={{ opacity: [0.7, 1, 0.7] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  ●
                </motion.span>
              )}
            </span>
            {loading && !hasLiveData ? (
              <span className="text-xl font-bold text-white">-</span>
            ) : (
              <div className="flex flex-col min-h-[28px] justify-center">
                <AnimatedNumber 
                  value={currentStreams} 
                  className={`text-xl font-bold ${isShowingLiveData ? 'text-purple-400' : 'text-white'}`} 
                />
                {(hasLiveTwitchData && hasLiveKickData) && (twitchStreams > 0 || kickStreams > 0) && (
                  <span className="text-[10px] text-gray-500 mt-0.5">
                    {twitchStreams > 0 && `${twitchStreams} Twitch`}
                    {twitchStreams > 0 && kickStreams > 0 && ' • '}
                    {kickStreams > 0 && `${kickStreams} Kick`}
                  </span>
                )}
              </div>
            )}
          </motion.div>

          {/* Peak Streams - HISTORICAL DATA */}
          <motion.div 
            className="flex flex-col"
            variants={statItemVariants}
            initial="hidden"
            animate="visible"
            custom={4}
          >
            <span className="text-xs text-gray-400">Peak Streams</span>
            <div className="min-h-[28px] flex items-center">
              {loading ? (
                <span className="text-xl font-bold text-white">-</span>
              ) : (
                <AnimatedNumber value={streamPeak} className="text-xl font-bold text-white" />
              )}
            </div>
          </motion.div>

          {/* Average Streams - HISTORICAL DATA */}
          <motion.div 
            className="flex flex-col"
            variants={statItemVariants}
            initial="hidden"
            animate="visible"
            custom={5}
          >
            <span className="text-xs text-gray-400">Average Streams</span>
            <div className="min-h-[28px] flex items-center">
              {loading ? (
                <span className="text-xl font-bold text-white">-</span>
              ) : (
                <AnimatedNumber value={streamAverage} className="text-xl font-bold text-white" />
              )}
            </div>
          </motion.div>
          
          {/* Current Viewers - LIVE DATA */}
          <motion.div 
            className="flex flex-col"
            variants={statItemVariants}
            initial="hidden"
            animate="visible"
            custom={6}
          >
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <div className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {(hasLiveTwitchData && hasLiveKickData) && (
                  <div className="flex items-center gap-0.5">
                    <Twitch className="h-2.5 w-2.5 text-purple-400" />
                    <KickIcon className="h-2.5 w-2.5" style={{ color: '#53FC18' }} />
                  </div>
                )}
              </div>
              Current Viewers
              {isShowingLiveData && (
                <motion.span 
                  className="text-green-400 text-[10px]"
                  animate={{ opacity: [0.7, 1, 0.7] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  ●
                </motion.span>
              )}
            </span>
            {loading && !hasLiveData ? (
              <span className="text-xl font-bold text-white">-</span>
            ) : (
              <div className="flex flex-col min-h-[28px] justify-center">
                <AnimatedNumber 
                  value={currentViewers} 
                  className={`text-xl font-bold ${isShowingLiveData ? 'text-purple-400' : 'text-white'}`} 
                />
                {(hasLiveTwitchData && hasLiveKickData) && (twitchViewers > 0 || kickViewers > 0) && (
                  <span className="text-[10px] text-gray-500 mt-0.5">
                    {twitchViewers > 0 && `${twitchViewers.toLocaleString()} Twitch`}
                    {twitchViewers > 0 && kickViewers > 0 && ' • '}
                    {kickViewers > 0 && `${kickViewers.toLocaleString()} Kick`}
                  </span>
                )}
              </div>
            )}
          </motion.div>

          {/* Peak Viewers - HISTORICAL DATA */}
          <motion.div 
            className="flex flex-col"
            variants={statItemVariants}
            initial="hidden"
            animate="visible"
            custom={7}
          >
            <span className="text-xs text-gray-400">Peak Viewers</span>
            <div className="min-h-[28px] flex items-center">
              {loading ? (
                <span className="text-xl font-bold text-white">-</span>
              ) : (
                <AnimatedNumber value={viewerPeak} className="text-xl font-bold text-white" />
              )}
            </div>
          </motion.div>

          {/* Average Viewers - HISTORICAL DATA */}
          <motion.div 
            className="flex flex-col"
            variants={statItemVariants}
            initial="hidden"
            animate="visible"
            custom={8}
          >
            <span className="text-xs text-gray-400">Average Viewers</span>
            <div className="min-h-[28px] flex items-center">
              {loading ? (
                <span className="text-xl font-bold text-white">-</span>
              ) : (
                <AnimatedNumber value={viewerAverage} className="text-xl font-bold text-white" />
              )}
            </div>
          </motion.div>
        </CardContent>
        <CardFooter className="pt-2 pb-4 flex flex-wrap gap-2">
          <Link href={`/streams/${serverId}`} className="flex-1 min-w-fit">
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={springs.stiff}
            >
              <button className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#18181b] text-white rounded-md hover:bg-[#26262c] hover:shadow-lg hover:shadow-[#00D9FF]/20 transition-all text-xs font-medium border border-[#26262c] hover:border-[#00D9FF]/50">
                <motion.div
                  className="flex items-center gap-1"
                  animate={{ 
                    opacity: currentStreams > 0 ? [1, 0.5, 1] : 1
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
                <span>Live Streams</span>
                <motion.span 
                  className="inline-flex items-center justify-center bg-[#26262c] rounded-full h-4 w-4 text-[10px] font-semibold"
                  key={currentStreams}
                  initial={{ scale: 1.3 }}
                  animate={{ scale: 1 }}
                  transition={springs.bouncy}
                >
                  {currentStreams}
                </motion.span>
              </button>
            </motion.div>
          </Link>
          {onViewChanges && (
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={springs.stiff}
            >
              <button 
                onClick={onViewChanges}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#18181b] text-white rounded-md hover:bg-[#26262c] hover:shadow-lg hover:shadow-[#00D9FF]/20 transition-all text-xs font-medium border border-[#26262c] hover:border-[#00D9FF]/50"
              >
                <span>Server Changes</span>
              </button>
            </motion.div>
          )}
        </CardFooter>
      </Card>
    </motion.div>
  )
}

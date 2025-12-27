"use client"

import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { type PlayerCountData, StreamCountData, ViewerCountData, ServerCapacityData, getServerStats, getStreamerStats, getViewerStats, calculateTimeAtMaxCapacity } from "@/lib/data"
import { Users, Twitch, TrendingUp, Wifi, WifiOff, Radio } from 'lucide-react'
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { motion } from "motion/react"
import { AnimatedNumber, PulseIndicator } from "@/components/ui/motion"
import { cardHover, springs } from "@/lib/motion"
import { type LiveServerData } from "@/hooks/use-live-server-data"

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
  liveLoading = false
}: ServerStatsCardsProps) {
  // Historical stats (peak/average from Supabase data)
  const { peak: historicalPeak, average: historicalAverage } = getServerStats(playerData, serverId)
  const { streamPeak, streamAverage } = getStreamerStats(streamerData, serverId)
  const { viewerPeak, viewerAverage } = getViewerStats(viewerData, serverId)
  
  // Live data values (current from direct API) - NO DATABASE FALLBACK
  // Current values MUST come from live APIs to ensure accuracy
  const hasLiveFiveMData = !!liveData?.fivem
  const hasLiveTwitchData = !!liveData?.twitch
  const hasLiveData = hasLiveFiveMData || hasLiveTwitchData
  
  // Current values - ONLY from live API, no database fallback
  const currentPlayers = liveData?.fivem?.currentPlayers ?? 0
  const liveMaxCapacity = liveData?.fivem?.maxCapacity ?? 0
  const currentStreams = liveData?.twitch?.streamCount ?? 0
  const currentViewers = liveData?.twitch?.viewerCount ?? 0
  const isOnline = liveData?.fivem?.online ?? false
  
  // Get latest max capacity - prefer live data
  const latestCapacity = hasLiveData && liveMaxCapacity > 0 
    ? liveMaxCapacity 
    : capacityData
        .filter(d => d.server_id === serverId)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]?.max_capacity || null
  
  // Calculate % time at max capacity (historical data only)
  const timeAtMaxPercent = calculateTimeAtMaxCapacity(playerData, capacityData, serverId)

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
            <div className="flex items-baseline gap-1">
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
            {loading ? (
              <span className="text-xl font-bold text-white">-</span>
            ) : (
              <AnimatedNumber value={historicalPeak} className="text-xl font-bold text-white" />
            )}
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
            {loading ? (
              <span className="text-xl font-bold text-white">-</span>
            ) : (
              <AnimatedNumber value={historicalAverage} className="text-xl font-bold text-white" />
            )}
          </motion.div>
          
          {/* Time at Max Capacity - HISTORICAL DATA */}
          {!loading && latestCapacity && timeAtMaxPercent > 0 && (
            <motion.div 
              className="flex flex-col col-span-3 pt-2 border-t border-gray-700"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              transition={{ delay: 0.3, ...springs.smooth }}
            >
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <motion.span
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <TrendingUp className="h-3 w-3" />
                </motion.span>
                Time at Max Capacity
              </span>
              <AnimatedNumber value={timeAtMaxPercent} className="text-xl font-bold text-white" formatFn={(v) => `${Math.round(v)}%`} />
            </motion.div>
          )}
          
          {/* Current Streams - LIVE DATA */}
          <motion.div 
            className="flex flex-col"
            variants={statItemVariants}
            initial="hidden"
            animate="visible"
            custom={3}
          >
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Twitch className="h-3 w-3 text-purple-400" /> Current Streams
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
              <AnimatedNumber 
                value={currentStreams} 
                className={`text-xl font-bold ${isShowingLiveData ? 'text-purple-400' : 'text-white'}`} 
              />
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
            {loading ? (
              <span className="text-xl font-bold text-white">-</span>
            ) : (
              <AnimatedNumber value={streamPeak} className="text-xl font-bold text-white" />
            )}
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
            {loading ? (
              <span className="text-xl font-bold text-white">-</span>
            ) : (
              <AnimatedNumber value={streamAverage} className="text-xl font-bold text-white" />
            )}
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
              <Users className="h-3 w-3" /> Current Viewers
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
              <AnimatedNumber 
                value={currentViewers} 
                className={`text-xl font-bold ${isShowingLiveData ? 'text-purple-400' : 'text-white'}`} 
              />
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
            {loading ? (
              <span className="text-xl font-bold text-white">-</span>
            ) : (
              <AnimatedNumber value={viewerPeak} className="text-xl font-bold text-white" />
            )}
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
            {loading ? (
              <span className="text-xl font-bold text-white">-</span>
            ) : (
              <AnimatedNumber value={viewerAverage} className="text-xl font-bold text-white" />
            )}
          </motion.div>
        </CardContent>
        <CardFooter className="pt-2 pb-4">
          <Link href={`/streams/${serverId}`} className="w-full">
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={springs.stiff}
            >
              <Button variant="outline" className="w-full flex items-center gap-2 bg-gray-700 border-gray-600 text-white hover:bg-gray-600">
                <motion.span
                  animate={{ 
                    opacity: currentStreams > 0 ? [1, 0.5, 1] : 1
                  }}
                  transition={{ 
                    duration: 2, 
                    repeat: currentStreams > 0 ? Infinity : 0,
                    ease: "easeInOut"
                  }}
                >
                  <Twitch className="h-4 w-4 text-purple-400" />
                </motion.span>
                <span>View Live Streams</span>
                <motion.span 
                  className="inline-flex items-center justify-center bg-gray-600 rounded-full h-5 w-5 text-xs ml-1"
                  key={currentStreams}
                  initial={{ scale: 1.3 }}
                  animate={{ scale: 1 }}
                  transition={springs.bouncy}
                >
                  {currentStreams}
                </motion.span>
              </Button>
            </motion.div>
          </Link>
        </CardFooter>
      </Card>
    </motion.div>
  )
}

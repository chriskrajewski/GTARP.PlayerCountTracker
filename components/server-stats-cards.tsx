import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { type PlayerCountData, StreamCountData, ViewerCountData, getServerStats, getStreamerStats, getViewerStats } from "@/lib/data"
import { Users, Twitch } from 'lucide-react'
import Link from "next/link"
import { Button } from "@/components/ui/button"

interface ServerStatsCardsProps {
  playerData: PlayerCountData[]
  streamerData: StreamCountData[]
  viewerData: ViewerCountData[]
  serverId: string
  serverName: string
  loading: boolean
}


export default function ServerStatsCards({ playerData, streamerData, viewerData, serverId, serverName, loading }: ServerStatsCardsProps) {
  const { current, peak, average } = getServerStats(playerData, serverId)
  const { streamCurrent, streamPeak, streamAverage  } = getStreamerStats(streamerData, serverId)
  const { viewerCurrent, viewerPeak, viewerAverage  } = getViewerStats(viewerData, serverId)

  return (
    <Card className="col-span-1 bg-gray-800 border-gray-700">
      <CardHeader className="pb-2 border-b border-gray-700">
        <CardTitle className="text-lg font-medium text-white">{serverName}</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-3 gap-4 pt-4">
        <div className="flex flex-col">
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <Users className="h-3 w-3" /> Current Players
          </span>
          <span className="text-xl font-bold text-white">{loading ? "-" : current}</span>
        </div>

        <div className="flex flex-col">
          <span className="text-xs text-gray-400">Peak Players</span>
          <span className="text-xl font-bold text-white">{loading ? "-" : peak}</span>
        </div>

        <div className="flex flex-col">
          <span className="text-xs text-gray-400">Average Players</span>
          <span className="text-xl font-bold text-white">{loading ? "-" : average}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <Twitch className="h-3 w-3 text-purple-400" /> Current Streams
          </span>
          <span className="text-xl font-bold text-white">{loading ? "-" : streamCurrent}</span>
        </div>

        <div className="flex flex-col">
          <span className="text-xs text-gray-400">Peak Streams</span>
          <span className="text-xl font-bold text-white">{loading ? "-" : streamPeak}</span>
        </div>

        <div className="flex flex-col">
          <span className="text-xs text-gray-400">Average Streams</span>
          <span className="text-xl font-bold text-white">{loading ? "-" : streamAverage}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <Users className="h-3 w-3" /> Current Viewers
          </span>
          <span className="text-xl font-bold text-white">{loading ? "-" : viewerCurrent}</span>
        </div>

        <div className="flex flex-col">
          <span className="text-xs text-gray-400">Peak Viewers</span>
          <span className="text-xl font-bold text-white">{loading ? "-" : viewerPeak}</span>
        </div>

        <div className="flex flex-col">
          <span className="text-xs text-gray-400">Average Viewers</span>
          <span className="text-xl font-bold text-white">{loading ? "-" : viewerAverage}</span>
        </div>
      </CardContent>
      <CardFooter className="pt-2 pb-4">
        <Link href={`/streams/${serverId}`} className="w-full">
          <Button variant="outline" className="w-full flex items-center gap-2 bg-gray-700 border-gray-600 text-white hover:bg-gray-600">
            <Twitch className="h-4 w-4 text-purple-400" />
            <span>View Live Streams</span>
            <span className="inline-flex items-center justify-center bg-gray-600 rounded-full h-5 w-5 text-xs ml-1">
              {streamCurrent}
            </span>
          </Button>
        </Link>
      </CardFooter>
    </Card>
  )
}

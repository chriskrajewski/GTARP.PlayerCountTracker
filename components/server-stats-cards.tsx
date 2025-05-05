import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { type PlayerCountData, getServerStats } from "@/lib/data"
import { Users } from 'lucide-react'

interface ServerStatsCardsProps {
  playerData: PlayerCountData[]
  serverId: string
  serverName: string
  loading: boolean
}

export default function ServerStatsCards({ playerData, serverId, serverName, loading }: ServerStatsCardsProps) {
  const { current, peak, average } = getServerStats(playerData, serverId)

  return (
    <Card className="col-span-1">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-medium">{serverName}</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-3 gap-4">
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Users className="h-3 w-3" /> Current
          </span>
          <span className="text-xl font-bold">{loading ? "-" : current}</span>
        </div>

        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground">Peak</span>
          <span className="text-xl font-bold">{loading ? "-" : peak}</span>
        </div>

        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground">Average</span>
          <span className="text-xl font-bold">{loading ? "-" : average}</span>
        </div>
      </CardContent>
    </Card>
  )
}

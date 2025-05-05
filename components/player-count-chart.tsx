"use client"

import { Line, LineChart, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer, Tooltip } from "recharts"
import { ChartContainer } from "@/components/ui/chart"
import type { AggregatedData } from "@/lib/data"
import type { TimeRange } from "@/lib/data"
import "../app/globals.css"

interface PlayerCountChartProps {
  data: AggregatedData[]
  serverIds: string[]
  serverNames: Record<string, string>
  loading: boolean
  timeRange: TimeRange
}

export default function PlayerCountChart({ data, serverIds, serverNames, loading, timeRange }: PlayerCountChartProps) {
  if (loading) {
    return (
      <div className="flex h-[350px] items-center justify-center">
        <p className="text-muted-foreground">Loading chart data...</p>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="flex h-[350px] items-center justify-center">
        <p className="text-muted-foreground">No data available for the selected time range</p>
      </div>
    )
  }

  // Create a config object for the chart
  const chartConfig: Record<string, { label: string; color: string }> = {}

  // Define colors for each server
  const colors = [
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
    "hsl(var(--chart-5))",
  ]

  serverIds.forEach((serverId, index) => {
    chartConfig[serverId] = {
      label: serverNames[serverId] || `Server ${serverId}`,
      color: colors[index % colors.length],
    }
  })

  // Format the timestamp for display based on time range
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)

    // Different format based on time range
    switch (timeRange) {
      case "1h":
      case "2h":
      case "4h":
      case "6h":
        // Format: 12:30
        return date.toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
        })
      case "8h":
      case "24h":
        // Format: 12:00
        return date.toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
        })
      case "7d":
      case "30d":
        // Format: Jan 1
        return date.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        })
      case "90d":
      case "180d":
        // Format: Jan 1 - Jan 7 (for week)
        if (timestamp.includes("W")) {
          const [year, week] = timestamp.split("-W").map((part) => Number.parseInt(part))
          return `Week ${week}, ${year}`
        }
        // Format: Jan 1
        return date.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        })
      case "365d":
      case "all":
        // Format: Jan 2023
        return date.toLocaleDateString(undefined, {
          month: "short",
          year: "numeric",
        })
      default:
        return timestamp
    }
  }

  // Format for tooltip
  const formatTooltipTimestamp = (timestamp: string) => {
    // If it's a week format like "2023-W01"
    if (timestamp.includes("W")) {
      const [year, week] = timestamp.split("-W").map((part) => Number.parseInt(part))
      return `Week ${week}, ${year}`
    }

    const date = new Date(timestamp)

    // Different format based on time range
    switch (timeRange) {
      case "1h":
      case "2h":
      case "4h":
      case "6h":
      case "8h":
      case "24h":
        // Format: Jan 1, 2023 12:30 PM
        return date.toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      case "7d":
        return date.toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      case "30d":
        // Format: Jan 1, 2023
        return date.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      case "90d":
      case "180d":
        // Format: Jan 1 - Jan 7, 2023 (for week)
        if (timestamp.includes("W")) {
          return `Week ${timestamp.split("-W")[1]}, ${timestamp.split("-W")[0]}`
        }
        // Format: Jan 1, 2023
        return date.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      case "365d":
      case "all":
        // Format: January 2023
        return date.toLocaleDateString(undefined, {
          month: "long",
          year: "numeric",
        })
      default:
        return timestamp
    }
  }

  

  return (
    <ChartContainer config={chartConfig} className="text-muted-foreground">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="4 4" />
          <XAxis
            dataKey="timestamp"
            tickFormatter={formatTimestamp}
            tick={{ fontSize: 12 }}
            interval="preserveStartEnd"
          />
          <YAxis />
          <Tooltip labelFormatter={formatTooltipTimestamp}  />
          <Legend />
          {serverIds.map((serverId) => (
            <Line
              key={serverId}
              type="monotone"
              dataKey={serverId}
              stroke={`var(--color-${serverId})`}
              name={serverNames[serverId] || `Server ${serverId}`}
              strokeWidth={2}
              dot={data.length < 30}
              activeDot={{ r: 6 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}

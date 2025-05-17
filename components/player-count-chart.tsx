"use client"

import { useEffect, useState } from "react"
import { Line, LineChart, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer, Tooltip } from "recharts"
import { ChartContainer } from "@/components/ui/chart"
import type { AggregatedData, ServerColor } from "@/lib/data"
import { getServerColors } from "@/lib/data"
import type { TimeRange } from "@/lib/data"
import "../app/globals.css"

interface PlayerCountChartProps {
  data: AggregatedData[]
  serverIds: string[]
  serverNames: Record<string, string>
  loading: boolean
  timeRange: TimeRange
}

// Generate a random HSL color with good visibility
function generateRandomColor(serverId: string): string {
  // Use the server ID as a seed for consistent randomness per server
  // This ensures the same server gets the same "random" color each time
  const hash = serverId.split('').reduce((acc, char) => {
    return char.charCodeAt(0) + ((acc << 5) - acc);
  }, 0);
  
  // Generate HSL values with high saturation and medium lightness for good visibility
  const h = Math.abs(hash % 360); // Hue: 0-359
  const s = 65 + (hash % 25); // Saturation: 65-89%
  const l = 45 + (hash % 15); // Lightness: 45-59%
  
  return `hsl(${h}, ${s}%, ${l}%)`;
}

export default function PlayerCountChart({ data, serverIds, serverNames, loading, timeRange }: PlayerCountChartProps) {
  const [serverColors, setServerColors] = useState<Record<string, string>>({});
  const [randomColorCache, setRandomColorCache] = useState<Record<string, string>>({});
  
  // Fetch server colors from Supabase
  useEffect(() => {
    async function loadServerColors() {
      try {
        const colors = await getServerColors();
        const colorMap: Record<string, string> = {};
        
        // Create a mapping of server_id to color
        colors.forEach(color => {
          colorMap[color.server_id] = color.color_hsl;
        });
        
        setServerColors(colorMap);
      } catch (error) {
        console.error("Error loading server colors:", error);
      }
    }
    
    loadServerColors();
  }, []);

  // Generate and cache random colors for servers not in the database
  useEffect(() => {
    const newRandomColors: Record<string, string> = { ...randomColorCache };
    let hasNewColors = false;
    
    serverIds.forEach(serverId => {
      // Skip if the server has a color in the database
      if (serverColors[serverId]) return;
      
      // Skip if we've already generated a random color for this server
      if (randomColorCache[serverId]) return;
      
      // Generate and cache a new random color
      newRandomColors[serverId] = generateRandomColor(serverId);
      hasNewColors = true;
    });
    
    if (hasNewColors) {
      setRandomColorCache(newRandomColors);
    }
  }, [serverIds, serverColors, randomColorCache]);

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

  serverIds.forEach((serverId) => {
    const originalLabel = serverNames[serverId] || `Server ${serverId}`;
    
    // First check if we have a color from Supabase
    if (serverColors[serverId]) {
      chartConfig[serverId] = {
        label: originalLabel,
        color: serverColors[serverId], // Use the Supabase color
      };
    } else {
      // Use random color from cache or generate a new one
      const randomColor = randomColorCache[serverId] || generateRandomColor(serverId);
      
      chartConfig[serverId] = {
        label: originalLabel,
        color: randomColor,
      };
    }
  });

  // Format the timestamp for display based on time range
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    
    // Ensure we're using the user's local timezone
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
          timeZone: "UTC",
          timeZoneName: undefined,
          hour12: true
        })
      case "8h":
      case "24h":
        // Format: 12:00
        return date.toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "UTC",
          timeZoneName: undefined,
          hour12: true
        })
      case "7d":
      case "30d":
        // Format: Jan 1
        return date.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          timeZone: "UTC"
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
          timeZone: "UTC"
        })
      case "365d":
      case "all":
        // Format: Jan 2023
        return date.toLocaleDateString(undefined, {
          month: "short",
          year: "numeric",
          timeZone: "UTC"
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
          timeZone: "UTC",
          timeZoneName: "short"
        })
      case "7d":
        return date.toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "UTC",
          timeZoneName: "short"
        })
      case "30d":
        // Format: Jan 1, 2023
        return date.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
          timeZone: "UTC"
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
          timeZone: "UTC"
        })
      case "365d":
      case "all":
        // Format: January 2023
        return date.toLocaleDateString(undefined, {
          month: "long",
          year: "numeric",
          timeZone: "UTC"
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
              stroke={chartConfig[serverId]?.color || "hsl(var(--chart-5))"}
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

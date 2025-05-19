"use client"

import { useState, useEffect, useMemo } from "react"
import { ChartContainer } from "@/components/ui/chart"
import type { TimeRange, ServerColor } from "@/lib/data"
import "../app/globals.css"
import { ApexOptions } from "apexcharts"
import dynamic from 'next/dynamic'
import { getServerColors } from "@/lib/data"

// Dynamically import ApexCharts to prevent SSR issues
const Chart = dynamic(() => import('react-apexcharts'), { ssr: false })

interface PlayerCountChartProps {
  data: Array<Record<string, any>>
  serverIds: string[]
  serverNames: Record<string, string>
  loading: boolean
  timeRange: TimeRange
}

type ChartConfigItem = {
  color: string
}

type ChartConfig = Record<string, ChartConfigItem>

export default function PlayerCountChart({ 
  data, 
  serverIds, 
  serverNames, 
  loading, 
  timeRange
}: PlayerCountChartProps) {
  
  // Initialize color cache
  const [randomColorCache, setRandomColorCache] = useState<Record<string, string>>({});
  // State for storing colors from the database
  const [dbColors, setDbColors] = useState<Record<string, string>>({});
  const [isLoadingColors, setIsLoadingColors] = useState(true);
  
  // Predefined palette of highly distinct colors
  const distinctColors = [
    "hsl(0, 80%, 50%)",      // Red
    "hsl(210, 80%, 50%)",    // Blue
    "hsl(48, 80%, 50%)",     // Gold
    "hsl(180, 80%, 50%)",    // Cyan
    "hsl(30, 80%, 50%)",     // Orange
    "hsl(240, 80%, 50%)",    // Indigo
    "hsl(15, 80%, 50%)",     // Vermilion
    "hsl(195, 80%, 50%)",    // Sky Blue
    "hsl(135, 80%, 50%)",    // Emerald
    "hsl(345, 80%, 50%)",    // Crimson
  ];
  
  // Additional colors with different saturation/lightness for more variety
  const extendedPalette = [
    ...distinctColors,
    ...distinctColors.map(color => {
      const hue = parseInt(color.match(/hsl\((\d+)/)?.[1] || "0", 10);
      return `hsl(${hue}, 65%, 65%)`;
    }),
    ...distinctColors.map(color => {
      const hue = parseInt(color.match(/hsl\((\d+)/)?.[1] || "0", 10);
      return `hsl(${hue}, 90%, 35%)`;
    })
  ];
  
  // Keep track of used colors from the palette
  const [usedColorIndices, setUsedColorIndices] = useState<number[]>([]);
  
  // Fetch colors from the database
  useEffect(() => {
    async function loadColors() {
      try {
        const colors = await getServerColors();
        console.log("Loaded colors from DB:", colors);
        
        // Convert to a map for easy lookup
        const colorMap: Record<string, string> = {};
        
        colors.forEach(color => {
          console.log(`Adding color to map: ${color.server_id} -> ${color.color_hsl}`);
          colorMap[color.server_id] = color.color_hsl;
        });
        
        console.log("Final color map created:", colorMap);
        console.log("Color map keys:", Object.keys(colorMap));
        console.log(`Map contains o3re8y? ${colorMap.hasOwnProperty('o3re8y')}`);
        
        // Set the database colors
        setDbColors(colorMap);
      } catch (error) {
        console.error("Error loading server colors:", error);
      } finally {
        setIsLoadingColors(false);
      }
    }
    
    loadColors();
  }, []);

  // Generate static random colors but consistent for each server
  const getRandomColor = (id: string) => {
    if (randomColorCache[id]) {
      return randomColorCache[id];
    }
    
    // Use the server ID to generate a hash
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = ((hash << 5) - hash) + id.charCodeAt(i);
      hash = hash & hash; // Convert to 32bit integer
    }
    hash = Math.abs(hash);
    
    // Find an unused color from the palette
    let colorIndex;
    const availableIndices = Array.from(
      { length: extendedPalette.length }, 
      (_, i) => i
    ).filter(i => !usedColorIndices.includes(i));
    
    if (availableIndices.length > 0) {
      // If we have unused colors, pick one based on the hash
      colorIndex = availableIndices[hash % availableIndices.length];
    } else {
      // If all colors are used, just pick one based on the hash
      colorIndex = hash % extendedPalette.length;
    }
    
    const color = extendedPalette[colorIndex];
    
    // Update usedColorIndices
    setUsedColorIndices(prev => [...prev, colorIndex]);
    
    // Update color cache
    setRandomColorCache(prev => ({
      ...prev,
      [id]: color
    }));
    
    console.log(`Generated distinct color for ${id}: ${color}`);
    return color;
  };
      
  // Get color for a server, prioritizing database colors
  const getServerColor = (serverId: string) => {
    // First check if we have a color in the database
    console.log(`Looking for color for server ID: "${serverId}"`);
    console.log(`Available dbColors keys: ${Object.keys(dbColors).join(', ')}`);
    console.log(`dbColors contains key ${serverId}? ${serverId in dbColors}`);
    
    // Check if the server ID might be case-sensitive
    const matchingKey = Object.keys(dbColors).find(key => 
      key.toLowerCase() === serverId.toLowerCase()
    );
    if (matchingKey && matchingKey !== serverId) {
      console.log(`Found case-insensitive match: ${matchingKey} vs ${serverId}`);
    }
    
    // Check for whitespace or hidden characters
    console.log(`Server ID character codes: ${Array.from(serverId).map(c => c.charCodeAt(0))}`);
    
    if (dbColors[serverId]) {
      console.log(`Using DB color for ${serverId}: ${dbColors[serverId]}`);
      return dbColors[serverId];
    }
    // Fall back to random color if not in database
    console.log(`No DB color for ${serverId}, using random color`);
    return getRandomColor(serverId);
  };
  
  // Wait for colors to load before rendering the chart
  if (isLoadingColors && typeof window !== 'undefined') {
    return <div className="h-[400px] w-full flex items-center justify-center">Loading chart colors...</div>;
  }
  
  // Log server IDs for debugging
  console.log("Server IDs for chart:", serverIds);
  console.log("Current DB colors:", dbColors);
  
  // Return the chart component
  return (
    <div className="h-[400px] w-full">
      {typeof window !== 'undefined' && (
        <Chart
          options={{
            chart: {
              type: 'line',
              height: 400,
              background: 'transparent',
              toolbar: {
                show: false
              }
            },
            colors: (() => {
              // Debug colors for each server ID
              const colors = serverIds.map(serverId => {
                const color = getServerColor(serverId);
                console.log(`Color for server ${serverId}: ${color}`);
                return color;
              });
              console.log('Final colors array:', colors);
              return colors;
            })(),
            stroke: {
              width: 3,
              curve: 'straight'
            },
            xaxis: {
              type: 'datetime',
              labels: {
                style: {
                  colors: '#EFEFF1'
                }
              }
            },
            yaxis: {
              labels: {
                style: {
                  colors: '#EFEFF1'
                }
              }
            },
            grid: {
              show: true,
              borderColor: "rgba(75, 85, 99, 0.1)",
              strokeDashArray: 2
            },
            theme: {
              mode: 'dark'
            },
            legend: {
              show: true,
              position: 'top',
              horizontalAlign: 'left',
              labels: {
                colors: '#EFEFF1'
              }
            }
          }}
          series={serverIds.map(serverId => ({
            name: serverNames[serverId] || `Server ${serverId}`,
            data: data.map(d => [
              new Date(d.timestamp).getTime(),
              d[serverId] || 0
            ])
          }))}
          type="line"
          height="400"
        />
      )}
    </div>
  )
}

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
  capacityData: Array<Record<string, any>>
  serverIds: string[]
  serverNames: Record<string, string>
  loading: boolean
  timeRange: TimeRange
  showCapacity: boolean
}

type ChartConfigItem = {
  color: string
}

type ChartConfig = Record<string, ChartConfigItem>

export default function PlayerCountChart({ 
  data, 
  capacityData,
  serverIds, 
  serverNames, 
  loading, 
  timeRange,
  showCapacity
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
        
        // Convert to a map for easy lookup
        const colorMap: Record<string, string> = {};
        
        colors.forEach(color => {
          colorMap[color.server_id] = color.color_hsl;
        });
        
        // Set the database colors
        setDbColors(colorMap);
      } catch (error) {
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
    
    return color;
  };
      
  // Get color for a server, prioritizing database colors
  const getServerColor = (serverId: string) => {
    // First check if we have a color in the database
    
    // Check if the server ID might be case-sensitive
    const matchingKey = Object.keys(dbColors).find(key => 
      key.toLowerCase() === serverId.toLowerCase()
    );
    if (matchingKey && matchingKey !== serverId) {
    }
    
    // Check for whitespace or hidden characters
    
    if (dbColors[serverId]) {
      return dbColors[serverId];
    }
    // Fall back to random color if not in database
    return getRandomColor(serverId);
  };
  
  // Wait for colors to load before rendering the chart
  if (isLoadingColors && typeof window !== 'undefined') {
    return <div className="h-[400px] w-full flex items-center justify-center">Loading chart colors...</div>;
  }
  
  
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
              // Color mapping for each server ID (player count)
              const playerColors = serverIds.map(serverId => {
                const color = getServerColor(serverId);
                return color;
              });
              
              // If showing capacity, add dashed/lighter versions of the same colors for capacity lines
              if (showCapacity) {
                const capacityColors = serverIds.map(serverId => {
                  const color = getServerColor(serverId);
                  // Convert HSL to a lighter/more transparent version for capacity line
                  const hslMatch = color.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
                  if (hslMatch) {
                    const [, h, s, l] = hslMatch;
                    // Increase lightness by 15% for capacity line
                    const newL = Math.min(100, parseInt(l) + 15);
                    return `hsl(${h}, ${s}%, ${newL}%)`;
                  }
                  return color;
                });
                return [...playerColors, ...capacityColors];
              }
              
              return playerColors;
            })(),
            stroke: {
              width: (() => {
                // Solid lines for player counts, thinner for capacity
                const playerWidths = serverIds.map(() => 3);
                if (showCapacity) {
                  const capacityWidths = serverIds.map(() => 2);
                  return [...playerWidths, ...capacityWidths];
                }
                return playerWidths;
              })(),
              curve: 'straight',
              dashArray: (() => {
                // Solid lines for player counts (0), dashed for capacity (5)
                const playerDash = serverIds.map(() => 0);
                if (showCapacity) {
                  const capacityDash = serverIds.map(() => 5);
                  return [...playerDash, ...capacityDash];
                }
                return playerDash;
              })()
            },
            xaxis: {
              type: 'datetime',
              labels: {
                style: {
                  colors: '#EFEFF1'
                },
                datetimeUTC: false,
                format: (() => {
                  // Dynamic formatting based on time range
                  if (timeRange === '1h' || timeRange === '2h' || timeRange === '4h' || timeRange === '6h' || timeRange === '8h') {
                    return 'h:mm TT';
                  } else if (timeRange === '24h') {
                    return 'h:mm TT';
                  } else if (timeRange === '7d') {
                    return 'MMM dd';
                  } else if (timeRange === '30d' || timeRange === '90d') {
                    return 'MMM dd';
                  } else {
                    return 'MMM yyyy';
                  }
                })(),
              },
              tooltip: {
                enabled: true
              }
            },
            yaxis: {
              min: 0,
              forceNiceScale: true,
              tickAmount: (() => {
                // Enhanced tick amounts for maximum granularity across ALL time ranges
                if (timeRange === '1h' || timeRange === '2h') {
                  return 6; // Maximum detail for very short ranges
                } else if (timeRange === '4h' || timeRange === '6h') {
                  return 7; // High detail for short ranges
                } else if (timeRange === '8h') {
                  return 8; // Enhanced detail for 8 hour range
                } else if (timeRange === '24h') {
                  return 999; // Maximum detail for 24 hour range
                } else if (timeRange === '7d') {
                  return 999; // Enhanced detail for 7 day range
                } else if (timeRange === '30d') {
                  return 999; // Maximum detail for 30 day range
                } else if (timeRange === '90d') {
                  return 999; // Ultimate detail for 90 day range
                } else if (timeRange === '180d') {
                  return 999; // Maximum detail for 6 month range
                } else if (timeRange === '365d') {
                  return 999; // Ultimate detail for 1 year range
                } else {
                  return 10; // Enhanced default fallback with high detail
                }
              })(),
              labels: {
                style: {
                  colors: '#EFEFF1'
                },
                formatter: function(value) {
                  return Math.round(value).toString();
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
            tooltip: {
              x: {
                format: 'MMM dd, yyyy h:mm TT'
              },
              y: {
                formatter: function(value) {
                  return value + ' players';
                }
              }
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
          series={[
            // Player count series for each server
            ...serverIds.map(serverId => ({
              name: serverNames[serverId] || `Server ${serverId}`,
              data: data
                .map(d => {
                  const value = d[serverId]
                  const numericValue = value === null || value === undefined ? null : (typeof value === 'number' ? value : 0)
                  
                  return {
                    x: new Date(d.timestamp).getTime(),
                    y: numericValue
                  }
                })
                .filter(point => point.y !== null) // Remove null data points to prevent chart gaps
            })),
            // Max capacity series for each server (if enabled)
            ...(showCapacity ? serverIds.map(serverId => ({
              name: `${serverNames[serverId] || `Server ${serverId}`} - Max Capacity`,
              data: capacityData
                .map(d => {
                  const value = d[`${serverId}_capacity`]
                  const numericValue = value === null || value === undefined ? null : (typeof value === 'number' ? value : 0)
                  
                  return {
                    x: new Date(d.timestamp).getTime(),
                    y: numericValue
                  }
                })
                .filter(point => point.y !== null)
            })) : [])
          ]}
          type="line"
          height="400"
        />
      )}
    </div>
  )
}

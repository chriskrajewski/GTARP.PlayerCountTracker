"use client"

import { useState, useEffect, useMemo } from "react"
import { ChartContainer } from "@/components/ui/chart"
import type { TimeRange } from "@/lib/data"
import "../app/globals.css"
import { ApexOptions } from "apexcharts"
import dynamic from 'next/dynamic'

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
  
  // Server colors configuration for the chart
  const serverColors: Record<string, string> = {
    "nopixel": "hsla(var(--nopixel), 1)",
    "eclipserpna": "hsla(var(--prodigy), 1)",
    "prodigy": "hsla(var(--prodigy), 1)",
    "onx": "hsla(var(--onx), 1)", 
    "unscripted": "hsla(var(--unscripted), 1)",
  };

  // Generate static random colors but consistent for each server
  const getRandomColor = (id: string) => {
    if (randomColorCache[id]) {
      return randomColorCache[id];
    }
    
    const hue = Math.floor(Math.random() * 360);
    const saturation = 70 + Math.floor(Math.random() * 30);
    const lightness = 45 + Math.floor(Math.random() * 10);
    
    const color = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    
    setRandomColorCache(prev => ({
      ...prev,
      [id]: color
    }));
    
    return color;
  };
      
  // Prepare chart configuration
  const chartConfig = useMemo(() => {
    const config: ChartConfig = {};
    
    serverIds.forEach((serverId) => {
      // Use predefined color if available, otherwise generate random
      const color = serverColors[serverId.toLowerCase()] || getRandomColor(serverId);
      
      config[serverId] = {
        color
      };
    });
    
    return config;
  }, [serverIds, serverColors, randomColorCache]);

  const chartColors = {
    grid: "rgba(75, 85, 99, 0.1)",
    text: "rgba(255, 255, 255, 0.6)",
    tooltip: {
      background: "#1F2937",
      border: "#4B5563",
      text: "#F9FAFB"
    }
  }
  
  // Configure the chart options
  const options: ApexOptions = {
    chart: {
      type: 'line',
      height: 400,
      fontFamily: 'Inter, sans-serif',
      background: 'transparent',
      toolbar: {
        show: false
      },
      zoom: {
        enabled: true,
        type: 'x',
        autoScaleYaxis: true
      }
    },
    theme: {
      mode: 'dark',
    },
    stroke: {
      curve: 'smooth',
      width: 3,
    },
    colors: [
      '#60A5FA',  // blue
      '#34D399',  // green
      '#F87171',  // red
      '#C084FC',  // purple
      '#FBBF24',  // yellow
    ],
    fill: {
      type: 'gradient',
      gradient: {
        opacityFrom: 0.3,
        opacityTo: 0.1,
      }
    },
    dataLabels: {
      enabled: false
    },
    grid: {
      show: true,
      borderColor: chartColors.grid,
      strokeDashArray: 2,
      position: 'back',
    },
    tooltip: {
      theme: 'dark',
      style: {
        fontSize: '12px',
        fontFamily: 'Inter, sans-serif',
      },
      x: {
        format: timeRange === '1h' || timeRange === '2h' || timeRange === '4h' || timeRange === '6h' || timeRange === '8h' || timeRange === '24h' 
          ? 'HH:mm' 
          : 'MMM dd',
      },
      y: {
        formatter: function(value: number) {
          return Math.round(value).toString()
        }
      },
      marker: {
        show: true,
      },
    },
    xaxis: {
      type: 'datetime',
      labels: {
        style: {
          colors: chartColors.text,
          fontSize: '12px',
          fontFamily: 'Inter, sans-serif',
        },
        format: 
          timeRange === '1h' || timeRange === '2h' || timeRange === '4h' || timeRange === '6h' || timeRange === '8h' ? 'HH:mm' :
          timeRange === '24h' ? 'HH:mm' :
          timeRange === '7d' ? 'dd MMM' :
          'MMM yyyy',
      },
      axisBorder: {
        show: false
      },
      axisTicks: {
        show: false
      },
      tooltip: {
        enabled: false
      }
    },
    yaxis: {
      labels: {
        style: {
          colors: chartColors.text,
          fontSize: '12px',
          fontFamily: 'Inter, sans-serif',
        },
        formatter: function(value: number) {
          return Math.round(value).toString()
        }
      },
      min: function(min: number) {
        // Get max value from all series
        const maxVal = data.reduce((max, item) => {
          const values = serverIds.map(id => item[id] || 0);
          const itemMax = Math.max(...values);
          return itemMax > max ? itemMax : max;
        }, 0);
        
        // Start from zero if min value is closer to zero than 20% of the range
        return min < (maxVal - min) * 0.2 ? 0 : min - (maxVal - min) * 0.1;
      },
      max: function(max: number) {
        // Get min value from all series
        const minVal = data.reduce((minValue, item) => {
          const values = serverIds.map(id => item[id] || 0);
          const itemMin = Math.min(...values);
          return itemMin < minValue ? itemMin : minValue;
        }, Infinity);
        
        // Add a little padding on top
        return max + (max - minVal) * 0.1;
      }
    },
    legend: {
      show: true,
      position: 'top',
      horizontalAlign: 'left',
      fontSize: '14px',
      fontFamily: 'Inter, sans-serif',
      labels: {
        colors: chartColors.text
      },
      markers: {
        size: 10,
        strokeWidth: 0,
        shape: 'circle',
        offsetX: 0,
        offsetY: 0
      },
      itemMargin: {
        horizontal: 10,
        vertical: 8
      }
    },
    responsive: [
      {
        breakpoint: 640,
        options: {
          chart: {
            height: 300
          },
          legend: {
            position: 'bottom',
            horizontalAlign: 'center'
          }
        }
      }
    ]
  };

  if (loading) {
    return (
      <div className="h-[400px] w-full">
        <div className="flex h-full items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
        </div>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="h-[400px] w-full">
        <div className="flex h-full items-center justify-center">
          <p className="text-center text-gray-400">No data available for the selected time range</p>
        </div>
      </div>
    )
  }

  // Format series data for ApexCharts
  const series = serverIds.map(serverId => ({
    name: serverNames[serverId] || `Server ${serverId}`,
    data: data.map(d => ({
      x: d.timestamp,
      y: d[serverId] || 0
    }))
  }));

  // Return the chart component
  return (
    <div className="h-[400px] w-full">
      {typeof window !== 'undefined' && (
        <Chart
          options={options}
          series={series}
          type="area"
          height="400"
        />
      )}
    </div>
  )
}

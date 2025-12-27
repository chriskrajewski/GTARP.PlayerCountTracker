"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import type { TimeRange, ServerColor } from "@/lib/data"
import "../app/globals.css"
import { getServerColors } from "@/lib/data"
import {
  createChart,
  IChartApi,
  ISeriesApi,
  Time,
  ColorType,
  LineStyle,
  CrosshairMode,
  LineSeries
} from 'lightweight-charts'

interface PlayerCountChartProps {
  data: Array<Record<string, any>>
  capacityData: Array<Record<string, any>>
  serverIds: string[]
  serverNames: Record<string, string>
  loading: boolean
  timeRange: TimeRange
  showCapacity: boolean
}

interface LineDataPoint {
  time: Time
  value: number
}

interface SeriesInfo {
  series: ISeriesApi<"Line">
  serverId: string
  isCapacity: boolean
  color: string
  name: string
}

export default function PlayerCountChartLW({
  data,
  capacityData,
  serverIds,
  serverNames,
  loading,
  timeRange,
  showCapacity
}: PlayerCountChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesMapRef = useRef<Map<string, SeriesInfo>>(new Map())
  const tooltipRef = useRef<HTMLDivElement>(null)
  const legendRef = useRef<HTMLDivElement>(null)

  // Initialize color cache
  const [randomColorCache, setRandomColorCache] = useState<Record<string, string>>({})
  const [dbColors, setDbColors] = useState<Record<string, string>>({})
  const [isLoadingColors, setIsLoadingColors] = useState(true)
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set())

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
  ]

  // Additional colors with different saturation/lightness for more variety
  const extendedPalette = useMemo(() => [
    ...distinctColors,
    ...distinctColors.map(color => {
      const hue = parseInt(color.match(/hsl\((\d+)/)?.[1] || "0", 10)
      return `hsl(${hue}, 65%, 65%)`
    }),
    ...distinctColors.map(color => {
      const hue = parseInt(color.match(/hsl\((\d+)/)?.[1] || "0", 10)
      return `hsl(${hue}, 90%, 35%)`
    })
  ], [])

  // Keep track of used colors from the palette
  const [usedColorIndices, setUsedColorIndices] = useState<number[]>([])

  // Fetch colors from the database
  useEffect(() => {
    async function loadColors() {
      try {
        const colors = await getServerColors()
        const colorMap: Record<string, string> = {}
        colors.forEach(color => {
          colorMap[color.server_id] = color.color_hsl
        })
        setDbColors(colorMap)
      } catch (error) {
        console.error("Failed to load server colors:", error)
      } finally {
        setIsLoadingColors(false)
      }
    }
    loadColors()
  }, [])

  // Generate static random colors but consistent for each server
  const getRandomColor = (id: string) => {
    if (randomColorCache[id]) {
      return randomColorCache[id]
    }

    // Use the server ID to generate a hash
    let hash = 0
    for (let i = 0; i < id.length; i++) {
      hash = ((hash << 5) - hash) + id.charCodeAt(i)
      hash = hash & hash // Convert to 32bit integer
    }
    hash = Math.abs(hash)

    // Find an unused color from the palette
    let colorIndex
    const availableIndices = Array.from(
      { length: extendedPalette.length },
      (_, i) => i
    ).filter(i => !usedColorIndices.includes(i))

    if (availableIndices.length > 0) {
      colorIndex = availableIndices[hash % availableIndices.length]
    } else {
      colorIndex = hash % extendedPalette.length
    }

    const color = extendedPalette[colorIndex]

    setUsedColorIndices(prev => [...prev, colorIndex])
    setRandomColorCache(prev => ({
      ...prev,
      [id]: color
    }))

    return color
  }

  // Get color for a server, prioritizing database colors
  const getServerColor = (serverId: string) => {
    const matchingKey = Object.keys(dbColors).find(key =>
      key.toLowerCase() === serverId.toLowerCase()
    )

    if (dbColors[serverId]) {
      return dbColors[serverId]
    }
    return getRandomColor(serverId)
  }

  // Convert HSL to RGB for Lightweight Charts
  const hslToRgb = (hsl: string): string => {
    const hslMatch = hsl.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/)
    if (!hslMatch) return hsl

    const h = parseInt(hslMatch[1]) / 360
    const s = parseInt(hslMatch[2]) / 100
    const l = parseInt(hslMatch[3]) / 100

    let r, g, b
    if (s === 0) {
      r = g = b = l
    } else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1
        if (t > 1) t -= 1
        if (t < 1 / 6) return p + (q - p) * 6 * t
        if (t < 1 / 2) return q
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
        return p
      }
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s
      const p = 2 * l - q
      r = hue2rgb(p, q, h + 1 / 3)
      g = hue2rgb(p, q, h)
      b = hue2rgb(p, q, h - 1 / 3)
    }

    return `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`
  }

  // Get lighter color for capacity lines
  const getLighterColor = (hsl: string): string => {
    const hslMatch = hsl.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/)
    if (hslMatch) {
      const [, h, s, l] = hslMatch
      const newL = Math.min(100, parseInt(l) + 15)
      return `hsl(${h}, ${s}%, ${newL}%)`
    }
    return hsl
  }

  // Format time based on time range
  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp * 1000)

    if (timeRange === '1h' || timeRange === '2h' || timeRange === '4h' || 
        timeRange === '6h' || timeRange === '8h' || timeRange === '24h') {
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      })
    } else if (timeRange === '7d' || timeRange === '30d' || timeRange === '90d') {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      })
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric'
      })
    }
  }


  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current || isLoadingColors) return

    // Create chart
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 400,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#EFEFF1',
      },
      grid: {
        vertLines: {
          color: 'rgba(75, 85, 99, 0.1)',
          style: LineStyle.Dashed,
        },
        horzLines: {
          color: 'rgba(75, 85, 99, 0.1)',
          style: LineStyle.Dashed,
        },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: 'rgba(239, 239, 241, 0.3)',
          width: 1,
          style: LineStyle.Dashed,
        },
        horzLine: {
          color: 'rgba(239, 239, 241, 0.3)',
          width: 1,
          style: LineStyle.Dashed,
        },
      },
      rightPriceScale: {
        borderColor: 'rgba(75, 85, 99, 0.3)',
        entireTextOnly: true,
      },
      localization: {
        priceFormatter: (price: number) => Math.round(price).toString(),
      },
      timeScale: {
        borderColor: 'rgba(75, 85, 99, 0.3)',
        timeVisible: true,
        secondsVisible: false,
        tickMarkFormatter: (time: Time) => {
          return formatTime(time as number)
        },
        rightOffset: 0,
        barSpacing: 6,
        fixLeftEdge: true,
        fixRightEdge: true,
        lockVisibleTimeRangeOnResize: true,
        rightBarStaysOnScroll: true,
      },
    })

    chartRef.current = chart

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        })
      }
    }

    window.addEventListener('resize', handleResize)

    // Setup crosshair move handler for tooltip
    chart.subscribeCrosshairMove((param) => {
      if (!tooltipRef.current || !legendRef.current) return

      if (!param.time || param.point === undefined || param.point.x < 0 || param.point.y < 0) {
        tooltipRef.current.style.display = 'none'
        return
      }

      const timestamp = param.time as number
      const date = new Date(timestamp * 1000)
      const formattedDate = date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      })

      let tooltipHtml = `<div style="font-weight: 600; margin-bottom: 8px; color: #EFEFF1;">${formattedDate}</div>`

      // Get values for all series at this timestamp (excluding capacity lines)
      seriesMapRef.current.forEach((seriesInfo) => {
        // Skip capacity lines in tooltip
        if (seriesInfo.isCapacity) {
          return
        }
        
        if (hiddenSeries.has(seriesInfo.serverId + (seriesInfo.isCapacity ? '_capacity' : ''))) {
          return
        }

        const value = param.seriesData.get(seriesInfo.series)
        if (value) {
          const dataValue = (value as any).value
          tooltipHtml += `
            <div style="display: flex; align-items: center; margin-bottom: 4px;">
              <div style="width: 12px; height: 12px; border-radius: 2px; background-color: ${seriesInfo.color}; margin-right: 8px;"></div>
              <span style="color: #9CA3AF; flex: 1;">${seriesInfo.name}:</span>
              <span style="color: #EFEFF1; font-weight: 600; margin-left: 8px;">${Math.round(dataValue)} players</span>
            </div>
          `
        }
      })

      tooltipRef.current.innerHTML = tooltipHtml
      tooltipRef.current.style.display = 'block'

      const tooltipWidth = 280
      const tooltipHeight = tooltipRef.current.offsetHeight
      const chartWidth = chartContainerRef.current?.clientWidth || 0

      let left = param.point.x + 20
      if (left + tooltipWidth > chartWidth) {
        left = param.point.x - tooltipWidth - 20
      }

      let top = param.point.y - 20
      if (top < 0) top = 20
      if (top + tooltipHeight > 400) {
        top = 400 - tooltipHeight - 20
      }

      tooltipRef.current.style.left = left + 'px'
      tooltipRef.current.style.top = top + 'px'
    })

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.remove()
      chartRef.current = null
      seriesMapRef.current.clear()
    }
  }, [isLoadingColors, hiddenSeries])

  // Update series data
  useEffect(() => {
    if (!chartRef.current || isLoadingColors) return

    // Clear existing series
    seriesMapRef.current.forEach((seriesInfo) => {
      chartRef.current?.removeSeries(seriesInfo.series)
    })
    seriesMapRef.current.clear()

    // Create player count series
    serverIds.forEach(serverId => {
      const hslColor = getServerColor(serverId)
      const color = hslToRgb(hslColor)
      const name = serverNames[serverId] || `Server ${serverId}`

      const lineSeries = chartRef.current!.addSeries(LineSeries, {
        color: color,
        lineWidth: 3,
        lineStyle: LineStyle.Solid,
        priceLineVisible: false,
        lastValueVisible: false,
      })

      // Transform data
      const seriesData: LineDataPoint[] = data
        .filter(d => {
          const value = d[serverId]
          const numericValue = value === null || value === undefined ? null : (typeof value === 'number' ? value : 0)
          return numericValue !== null
        })
        .map(d => {
          const value = d[serverId]
          const numericValue = (typeof value === 'number' ? value : 0)

          return {
            time: Math.floor(new Date(d.timestamp).getTime() / 1000) as Time,
            value: numericValue
          }
        })
        .sort((a, b) => (a.time as number) - (b.time as number))

      lineSeries.setData(seriesData)

      seriesMapRef.current.set(`${serverId}_player`, {
        series: lineSeries,
        serverId,
        isCapacity: false,
        color,
        name
      })
    })

    // Create capacity series if enabled
    if (showCapacity) {
      serverIds.forEach(serverId => {
        const hslColor = getServerColor(serverId)
        const lighterHslColor = getLighterColor(hslColor)
        const color = hslToRgb(lighterHslColor)
        const name = `${serverNames[serverId] || `Server ${serverId}`} - Max Capacity`

        const lineSeries = chartRef.current!.addSeries(LineSeries, {
          color: color,
          lineWidth: 2,
          lineStyle: LineStyle.Dashed,
          priceLineVisible: false,
          lastValueVisible: false,
        })

        // Transform capacity data
        const seriesData: LineDataPoint[] = capacityData
          .filter(d => {
            const value = d[`${serverId}_capacity`]
            const numericValue = value === null || value === undefined ? null : (typeof value === 'number' ? value : 0)
            return numericValue !== null
          })
          .map(d => {
            const value = d[`${serverId}_capacity`]
            const numericValue = (typeof value === 'number' ? value : 0)

            return {
              time: Math.floor(new Date(d.timestamp).getTime() / 1000) as Time,
              value: numericValue
            }
          })
          .sort((a, b) => (a.time as number) - (b.time as number))

        lineSeries.setData(seriesData)

        seriesMapRef.current.set(`${serverId}_capacity`, {
          series: lineSeries,
          serverId,
          isCapacity: true,
          color,
          name
        })
      })
    }

    // Fit content to viewport
    chartRef.current.timeScale().fitContent()

  }, [data, capacityData, serverIds, serverNames, showCapacity, isLoadingColors, dbColors, randomColorCache])

  // Update series visibility when hiddenSeries changes
  useEffect(() => {
    if (!chartRef.current) return

    seriesMapRef.current.forEach((seriesInfo, key) => {
      const isHidden = hiddenSeries.has(key)
      seriesInfo.series.applyOptions({
        visible: !isHidden
      })
    })
  }, [hiddenSeries])

  const toggleSeriesVisibility = (key: string) => {
    setHiddenSeries(prev => {
      const newSet = new Set(prev)
      if (newSet.has(key)) {
        newSet.delete(key)
      } else {
        newSet.add(key)
      }
      return newSet
    })
  }

  // Wait for colors to load before rendering the chart
  if (isLoadingColors && typeof window !== 'undefined') {
    return <div className="h-[400px] w-full flex items-center justify-center">Loading chart colors...</div>
  }

  return (
    <div className="w-full">
      {/* Legend */}
      <div
        ref={legendRef}
        className="flex flex-wrap gap-3 mb-3 px-2"
      >
        {serverIds.map(serverId => {
          const hslColor = getServerColor(serverId)
          const color = hslToRgb(hslColor)
          const name = serverNames[serverId] || `Server ${serverId}`
          const playerKey = `${serverId}_player`
          const capacityKey = `${serverId}_capacity`
          const isPlayerHidden = hiddenSeries.has(playerKey)
          const isCapacityHidden = hiddenSeries.has(capacityKey)

          return (
            <div key={serverId} className="flex flex-col gap-1">
              <button
                onClick={() => toggleSeriesVisibility(playerKey)}
                className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                style={{ opacity: isPlayerHidden ? 0.5 : 1 }}
              >
                <div
                  style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '2px',
                    backgroundColor: color,
                  }}
                />
                <span style={{ color: '#EFEFF1', fontSize: '13px' }}>{name}</span>
              </button>
              {showCapacity && (
                <button
                  onClick={() => toggleSeriesVisibility(capacityKey)}
                  className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity ml-4"
                  style={{ opacity: isCapacityHidden ? 0.5 : 1 }}
                >
                  <div
                    style={{
                      width: '12px',
                      height: '2px',
                      backgroundColor: hslToRgb(getLighterColor(hslColor)),
                      borderTop: '1px dashed',
                      borderBottom: '1px dashed',
                    }}
                  />
                  <span style={{ color: '#9CA3AF', fontSize: '12px' }}>Max Capacity</span>
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Chart Container */}
      <div style={{ position: 'relative' }}>
        <div ref={chartContainerRef} className="h-[400px] w-full" />
        
        {/* Tooltip */}
        <div
          ref={tooltipRef}
          style={{
            position: 'absolute',
            display: 'none',
            padding: '12px',
            backgroundColor: 'rgba(17, 24, 39, 0.95)',
            border: '1px solid rgba(75, 85, 99, 0.5)',
            borderRadius: '6px',
            fontSize: '13px',
            pointerEvents: 'none',
            zIndex: 1000,
            maxWidth: '280px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
          }}
        />
      </div>
    </div>
  )
}

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
  /** When true, enables TradingView-style live updates */
  isLiveMode?: boolean
  /** Current live player counts per server (for the price-line display) */
  currentCounts?: Record<string, number>
  /** Timestamp of the last live update */
  lastUpdate?: Date | null
  /** Polling interval in ms (for countdown) */
  pollingIntervalMs?: number
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
  showCapacity,
  isLiveMode = false,
  currentCounts = {},
  lastUpdate = null,
  pollingIntervalMs = 60000
}: PlayerCountChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesMapRef = useRef<Map<string, SeriesInfo>>(new Map())
  const tooltipRef = useRef<HTMLDivElement>(null)
  const legendRef = useRef<HTMLDivElement>(null)

  // Color state
  const [randomColorCache, setRandomColorCache] = useState<Record<string, string>>({})
  const [dbColors, setDbColors] = useState<Record<string, string>>({})
  const [isLoadingColors, setIsLoadingColors] = useState(true)
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set())

  // Countdown state for live mode
  const [countdown, setCountdown] = useState<number>(0)
  // Refs for custom price lines that show count + countdown on the price scale
  const priceLinesRef = useRef<Map<string, ReturnType<ISeriesApi<"Line">["createPriceLine"]>>>(new Map())

  const distinctColors = [
    "hsl(0, 80%, 50%)",
    "hsl(210, 80%, 50%)",
    "hsl(48, 80%, 50%)",
    "hsl(180, 80%, 50%)",
    "hsl(30, 80%, 50%)",
    "hsl(240, 80%, 50%)",
    "hsl(15, 80%, 50%)",
    "hsl(195, 80%, 50%)",
    "hsl(135, 80%, 50%)",
    "hsl(345, 80%, 50%)",
  ]

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

  const getRandomColor = (id: string) => {
    if (randomColorCache[id]) return randomColorCache[id]
    let hash = 0
    for (let i = 0; i < id.length; i++) {
      hash = ((hash << 5) - hash) + id.charCodeAt(i)
      hash = hash & hash
    }
    hash = Math.abs(hash)
    const availableIndices = Array.from({ length: extendedPalette.length }, (_, i) => i)
      .filter(i => !usedColorIndices.includes(i))
    const colorIndex = availableIndices.length > 0
      ? availableIndices[hash % availableIndices.length]
      : hash % extendedPalette.length
    const color = extendedPalette[colorIndex]
    setUsedColorIndices(prev => [...prev, colorIndex])
    setRandomColorCache(prev => ({ ...prev, [id]: color }))
    return color
  }

  const getServerColor = (serverId: string) => {
    if (dbColors[serverId]) return dbColors[serverId]
    const matchingKey = Object.keys(dbColors).find(key => key.toLowerCase() === serverId.toLowerCase())
    if (matchingKey) return dbColors[matchingKey]
    return getRandomColor(serverId)
  }

  const hslToRgb = (hsl: string): string => {
    const m = hsl.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/)
    if (!m) return hsl
    const h = parseInt(m[1]) / 360, s = parseInt(m[2]) / 100, l = parseInt(m[3]) / 100
    let r, g, b
    if (s === 0) { r = g = b = l } else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1; if (t > 1) t -= 1
        if (t < 1/6) return p + (q-p)*6*t
        if (t < 1/2) return q
        if (t < 2/3) return p + (q-p)*(2/3-t)*6
        return p
      }
      const q = l < 0.5 ? l*(1+s) : l+s-l*s, p = 2*l-q
      r = hue2rgb(p, q, h+1/3); g = hue2rgb(p, q, h); b = hue2rgb(p, q, h-1/3)
    }
    return `rgb(${Math.round(r*255)}, ${Math.round(g*255)}, ${Math.round(b*255)})`
  }

  const getLighterColor = (hsl: string): string => {
    const m = hsl.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/)
    if (m) { const newL = Math.min(100, parseInt(m[3]) + 15); return `hsl(${m[1]}, ${m[2]}%, ${newL}%)` }
    return hsl
  }

  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp * 1000)
    if (timeRange === 'live' || timeRange === '1h' || timeRange === '2h' || timeRange === '4h' ||
        timeRange === '6h' || timeRange === '8h' || timeRange === '24h') {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
    } else if (timeRange === '7d' || timeRange === '30d' || timeRange === '90d') {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    }
  }

  // ── Countdown timer for live mode — also updates price-line labels ──
  useEffect(() => {
    if (!isLiveMode || !lastUpdate) { setCountdown(0); return }
    const tick = () => {
      const elapsed = Date.now() - lastUpdate.getTime()
      const remaining = Math.max(0, Math.ceil((pollingIntervalMs - elapsed) / 1000))
      setCountdown(remaining)

      // Update price-line titles with current count + countdown
      priceLinesRef.current.forEach((priceLine, serverId) => {
        const count = currentCounts[serverId]
        if (count === undefined) return
        const label = remaining > 0 ? `${count}  ⏱${remaining}s` : `${count}  ⏱…`
        priceLine.applyOptions({ title: label })
      })
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [isLiveMode, lastUpdate, pollingIntervalMs, currentCounts])

  // ── Track previous data fingerprint for incremental updates ──
  const prevDataLengthRef = useRef(0)
  const prevServerIdsRef = useRef<string>('')

  // ── Initialize chart ──
  useEffect(() => {
    if (!chartContainerRef.current || isLoadingColors) return

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 400,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#EFEFF1',
      },
      grid: {
        vertLines: { color: 'rgba(75, 85, 99, 0.1)', style: LineStyle.Dashed },
        horzLines: { color: 'rgba(75, 85, 99, 0.1)', style: LineStyle.Dashed },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: 'rgba(239, 239, 241, 0.3)', width: 1, style: LineStyle.Dashed },
        horzLine: { color: 'rgba(239, 239, 241, 0.3)', width: 1, style: LineStyle.Dashed },
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
        tickMarkFormatter: (time: Time) => formatTime(time as number),
        rightOffset: isLiveMode ? 5 : 0,
        barSpacing: isLiveMode ? 8 : 6,
        fixLeftEdge: !isLiveMode,
        fixRightEdge: !isLiveMode,
        lockVisibleTimeRangeOnResize: true,
        rightBarStaysOnScroll: true,
      },
    })

    chartRef.current = chart

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth })
      }
    }
    window.addEventListener('resize', handleResize)

    // Tooltip on crosshair
    chart.subscribeCrosshairMove((param) => {
      if (!tooltipRef.current || !legendRef.current) return
      if (!param.time || param.point === undefined || param.point.x < 0 || param.point.y < 0) {
        tooltipRef.current.style.display = 'none'; return
      }
      const timestamp = param.time as number
      const date = new Date(timestamp * 1000)
      const formattedDate = date.toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true
      })
      let html = `<div style="font-weight:600;margin-bottom:8px;color:#EFEFF1;">${formattedDate}</div>`
      seriesMapRef.current.forEach((si) => {
        if (si.isCapacity) return
        if (hiddenSeries.has(si.serverId + (si.isCapacity ? '_capacity' : ''))) return
        const value = param.seriesData.get(si.series)
        if (value) {
          const v = (value as any).value
          html += `<div style="display:flex;align-items:center;margin-bottom:4px;">
            <div style="width:12px;height:12px;border-radius:2px;background:${si.color};margin-right:8px;"></div>
            <span style="color:#9CA3AF;flex:1;">${si.name}:</span>
            <span style="color:#EFEFF1;font-weight:600;margin-left:8px;">${Math.round(v)} players</span>
          </div>`
        }
      })
      tooltipRef.current.innerHTML = html
      tooltipRef.current.style.display = 'block'
      const tw = 280, th = tooltipRef.current.offsetHeight, cw = chartContainerRef.current?.clientWidth || 0
      let left = param.point.x + 20
      if (left + tw > cw) left = param.point.x - tw - 20
      let top = param.point.y - 20
      if (top < 0) top = 20
      if (top + th > 400) top = 400 - th - 20
      tooltipRef.current.style.left = left + 'px'
      tooltipRef.current.style.top = top + 'px'
    })

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.remove()
      chartRef.current = null
      seriesMapRef.current.clear()
      priceLinesRef.current.clear()
      prevDataLengthRef.current = 0
      prevServerIdsRef.current = ''
    }
  }, [isLoadingColors, hiddenSeries])

  // ── Update series data ──
  useEffect(() => {
    if (!chartRef.current || isLoadingColors) return

    const serverKey = serverIds.join(',')
    const isIncrementalUpdate = isLiveMode
      && seriesMapRef.current.size > 0
      && data.length > prevDataLengthRef.current
      && serverKey === prevServerIdsRef.current

    if (isIncrementalUpdate) {
      // Append only new points via update() — smooth, no flicker
      const newPoints = data.slice(prevDataLengthRef.current)

      serverIds.forEach(serverId => {
        const si = seriesMapRef.current.get(`${serverId}_player`)
        if (!si) return
        newPoints.forEach(d => {
          const v = d[serverId]
          if (v === null || v === undefined) return
          si.series.update({
            time: Math.floor(new Date(d.timestamp).getTime() / 1000) as Time,
            value: typeof v === 'number' ? v : 0
          })
        })
      })

      if (showCapacity) {
        const newCap = capacityData.slice(prevDataLengthRef.current)
        serverIds.forEach(serverId => {
          const si = seriesMapRef.current.get(`${serverId}_capacity`)
          if (!si) return
          newCap.forEach(d => {
            const v = d[`${serverId}_capacity`]
            if (v === null || v === undefined) return
            si.series.update({
              time: Math.floor(new Date(d.timestamp).getTime() / 1000) as Time,
              value: typeof v === 'number' ? v : 0
            })
          })
        })
      }

      chartRef.current.timeScale().scrollToRealTime()
      prevDataLengthRef.current = data.length
      prevServerIdsRef.current = serverKey

      // Update price-line positions to match latest values
      serverIds.forEach(serverId => {
        const count = currentCounts[serverId]
        const priceLine = priceLinesRef.current.get(serverId)
        if (priceLine && count !== undefined) {
          priceLine.applyOptions({ price: count })
        }
      })

      return
    }

    // ── Full rebuild ──
    prevDataLengthRef.current = data.length
    prevServerIdsRef.current = serverKey

    seriesMapRef.current.forEach(si => chartRef.current?.removeSeries(si.series))
    seriesMapRef.current.clear()
    priceLinesRef.current.clear()

    // Player count series
    serverIds.forEach(serverId => {
      const hslColor = getServerColor(serverId)
      const color = hslToRgb(hslColor)
      const name = serverNames[serverId] || `Server ${serverId}`

      const lineSeries = chartRef.current!.addSeries(LineSeries, {
        color,
        lineWidth: isLiveMode ? 2 : 3,
        lineStyle: LineStyle.Solid,
        // TradingView-style: show current value on the price scale + horizontal line
        priceLineVisible: false, // We use custom price lines instead
        lastValueVisible: isLiveMode,
        ...(isLiveMode ? { priceLineWidth: 1 as const, priceLineStyle: LineStyle.Dotted, priceLineColor: color } : {}),
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4,
      })

      const seriesData: LineDataPoint[] = data
        .filter(d => d[serverId] !== null && d[serverId] !== undefined)
        .map(d => ({
          time: Math.floor(new Date(d.timestamp).getTime() / 1000) as Time,
          value: typeof d[serverId] === 'number' ? d[serverId] : 0
        }))
        .sort((a, b) => (a.time as number) - (b.time as number))

      lineSeries.setData(seriesData)

      seriesMapRef.current.set(`${serverId}_player`, {
        series: lineSeries, serverId, isCapacity: false, color, name
      })

      // In live mode, add a custom price line that shows count + countdown on the price scale
      if (isLiveMode) {
        const count = currentCounts[serverId]
        const lastValue = seriesData.length > 0 ? seriesData[seriesData.length - 1].value : 0
        const displayValue = count !== undefined ? count : lastValue
        const label = count !== undefined ? `${count}  ⏱--` : `${lastValue}`

        const priceLine = lineSeries.createPriceLine({
          price: displayValue,
          color: color,
          lineWidth: 1 as const,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: label,
          axisLabelColor: color,
          axisLabelTextColor: '#0e0e10',
        })
        priceLinesRef.current.set(serverId, priceLine)
      }
    })

    // Capacity series
    if (showCapacity) {
      serverIds.forEach(serverId => {
        const hslColor = getServerColor(serverId)
        const lighterHsl = getLighterColor(hslColor)
        const color = hslToRgb(lighterHsl)
        const name = `${serverNames[serverId] || `Server ${serverId}`} - Max Capacity`

        const lineSeries = chartRef.current!.addSeries(LineSeries, {
          color,
          lineWidth: 2,
          lineStyle: LineStyle.Dashed,
          priceLineVisible: false,
          lastValueVisible: false,
        })

        const seriesData: LineDataPoint[] = capacityData
          .filter(d => d[`${serverId}_capacity`] !== null && d[`${serverId}_capacity`] !== undefined)
          .map(d => ({
            time: Math.floor(new Date(d.timestamp).getTime() / 1000) as Time,
            value: typeof d[`${serverId}_capacity`] === 'number' ? d[`${serverId}_capacity`] : 0
          }))
          .sort((a, b) => (a.time as number) - (b.time as number))

        lineSeries.setData(seriesData)

        seriesMapRef.current.set(`${serverId}_capacity`, {
          series: lineSeries, serverId, isCapacity: true, color, name
        })
      })
    }

    if (isLiveMode) {
      // Default zoom: show the last 30 minutes so the chart feels populated
      // Only works when there's actual data; fall back to scrollToRealTime otherwise
      const hasData = data.length > 0
      if (hasData) {
        try {
          const nowSec = Math.floor(Date.now() / 1000)
          const thirtyMinAgo = nowSec - 30 * 60
          chartRef.current.timeScale().setVisibleRange({
            from: thirtyMinAgo as Time,
            to: (nowSec + 120) as Time,
          })
        } catch {
          // setVisibleRange can throw if the range doesn't overlap with data
          chartRef.current.timeScale().scrollToRealTime()
        }
      } else {
        chartRef.current.timeScale().scrollToRealTime()
      }
    } else {
      chartRef.current.timeScale().fitContent()
    }
  }, [data, capacityData, serverIds, serverNames, showCapacity, isLoadingColors, isLiveMode, dbColors, randomColorCache])

  // Visibility toggle
  useEffect(() => {
    if (!chartRef.current) return
    seriesMapRef.current.forEach((si, key) => {
      si.series.applyOptions({ visible: !hiddenSeries.has(key) })
    })
  }, [hiddenSeries])

  const toggleSeriesVisibility = (key: string) => {
    setHiddenSeries(prev => {
      const s = new Set(prev)
      s.has(key) ? s.delete(key) : s.add(key)
      return s
    })
  }

  if (isLoadingColors && typeof window !== 'undefined') {
    return <div className="h-[400px] w-full flex items-center justify-center">Loading chart colors...</div>
  }

  return (
    <div className="w-full">
      {/* Legend */}
      <div ref={legendRef} className="flex flex-wrap gap-3 mb-3 px-2">
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
                <div style={{ width: '12px', height: '12px', borderRadius: '2px', backgroundColor: color }} />
                <span style={{ color: '#EFEFF1', fontSize: '13px' }}>{name}</span>
                {/* Live current count badge */}
                {isLiveMode && currentCounts[serverId] !== undefined && (
                  <span
                    className="ml-1 px-1.5 py-0.5 rounded text-xs font-mono font-bold"
                    style={{ backgroundColor: color, color: '#0e0e10' }}
                  >
                    {currentCounts[serverId]}
                  </span>
                )}
              </button>
              {showCapacity && (
                <button
                  onClick={() => toggleSeriesVisibility(capacityKey)}
                  className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity ml-4"
                  style={{ opacity: isCapacityHidden ? 0.5 : 1 }}
                >
                  <div style={{
                    width: '12px', height: '2px',
                    backgroundColor: hslToRgb(getLighterColor(hslColor)),
                    borderTop: '1px dashed', borderBottom: '1px dashed',
                  }} />
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

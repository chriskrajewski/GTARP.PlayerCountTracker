import { PlayerCountData } from './data'

/**
 * Represents a detected server restart event
 */
export interface RestartEvent {
  timestamp: string
  playerCountBefore: number
  playerCountAfter: number
  downtime: number // minutes
}

/**
 * Represents a detected restart pattern
 */
export interface RestartPattern {
  type: 'fixed-interval' | 'fixed-time' | 'irregular'
  interval?: number // hours (for fixed-interval)
  timeOfDay?: string // HH:MM (for fixed-time)
  variance: number // minutes
  occurrences: number
}

/**
 * Represents the final restart prediction
 */
export interface RestartPrediction {
  serverId: string
  nextRestartTime: string | null
  confidence: number // 0-100
  detectedPattern: string | null
  lastRestartTime: string | null
  averageDowntime: number // minutes
  detectedEvents: RestartEvent[]
}

/**
 * Detects restart events from player count data
 * A restart is identified by a rapid drop to near-zero followed by recovery
 */
export function detectRestartEvents(data: PlayerCountData[]): RestartEvent[] {
  if (data.length < 2) return []

  const events: RestartEvent[] = []
  const sortedData = [...data].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )

  for (let i = 1; i < sortedData.length; i++) {
    const prev = sortedData[i - 1]
    const curr = sortedData[i]

    const timeDiffMs = new Date(curr.timestamp).getTime() - new Date(prev.timestamp).getTime()
    const timeDiffMinutes = timeDiffMs / (1000 * 60)

    // Look for rapid drops within a reasonable time window (up to 30 minutes)
    if (timeDiffMinutes > 30) continue

    const dropPercentage = ((prev.player_count - curr.player_count) / Math.max(prev.player_count, 1)) * 100

    // Criteria: >80% drop AND reaches near-zero (< 5 players)
    if (dropPercentage > 80 && curr.player_count < 5) {
      // Look ahead to confirm recovery (server comes back online)
      let recoveryFound = false
      let recoveryTime = 0
      let recoveryIndex = -1

      for (let j = i + 1; j < Math.min(i + 20, sortedData.length); j++) {
        const future = sortedData[j]
        const recoveryDiffMs = new Date(future.timestamp).getTime() - new Date(curr.timestamp).getTime()
        const recoveryDiffMinutes = recoveryDiffMs / (1000 * 60)

        // Recovery must happen within 30 minutes
        if (recoveryDiffMinutes > 30) break

        // Recovery is when player count reaches >10% of pre-restart level
        if (future.player_count > prev.player_count * 0.1) {
          recoveryFound = true
          recoveryTime = recoveryDiffMinutes
          recoveryIndex = j
          break
        }
      }

      // Only count as restart if recovery is confirmed
      if (recoveryFound) {
        events.push({
          timestamp: curr.timestamp,
          playerCountBefore: prev.player_count,
          playerCountAfter: curr.player_count,
          downtime: recoveryTime
        })

        // Skip ahead to avoid duplicate detections
        i = recoveryIndex
      }
    }
  }

  return events
}

/**
 * Analyzes restart events to detect patterns
 */
export function analyzeRestartPattern(events: RestartEvent[]): RestartPattern | null {
  if (events.length < 2) return null

  const timestamps = events.map(e => new Date(e.timestamp).getTime())
  const intervals: number[] = []

  // Calculate intervals between consecutive restarts (in hours)
  for (let i = 1; i < timestamps.length; i++) {
    const intervalMs = timestamps[i] - timestamps[i - 1]
    const intervalHours = intervalMs / (1000 * 60 * 60)
    intervals.push(intervalHours)
  }

  // Calculate average interval and variance
  const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length
  const variance = Math.sqrt(
    intervals.reduce((sum, interval) => sum + Math.pow(interval - avgInterval, 2), 0) / intervals.length
  )
  const varianceMinutes = variance * 60

  // Check if it's a fixed-interval pattern (variance < 2 hours)
  if (varianceMinutes < 120) {
    return {
      type: 'fixed-interval',
      interval: Math.round(avgInterval * 10) / 10, // Round to 1 decimal
      variance: Math.round(varianceMinutes),
      occurrences: events.length
    }
  }

  // Check for fixed-time pattern (same time of day)
  const timeOfDayMap = new Map<string, number>()
  events.forEach(event => {
    const date = new Date(event.timestamp)
    const timeKey = `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`
    timeOfDayMap.set(timeKey, (timeOfDayMap.get(timeKey) || 0) + 1)
  })

  // Find the most common time of day
  let mostCommonTime = ''
  let maxOccurrences = 0
  timeOfDayMap.forEach((count, time) => {
    if (count > maxOccurrences) {
      maxOccurrences = count
      mostCommonTime = time
    }
  })

  // If at least 50% of restarts happen at the same time, consider it a fixed-time pattern
  if (maxOccurrences >= events.length * 0.5) {
    return {
      type: 'fixed-time',
      timeOfDay: mostCommonTime,
      variance: Math.round(varianceMinutes),
      occurrences: events.length
    }
  }

  // Otherwise, it's irregular
  return {
    type: 'irregular',
    variance: Math.round(varianceMinutes),
    occurrences: events.length
  }
}

/**
 * Calculates confidence score based on pattern consistency
 */
export function calculateConfidence(pattern: RestartPattern | null, events: RestartEvent[]): number {
  if (!pattern || events.length < 2) return 0

  // Base confidence on number of occurrences
  let confidence = Math.min(events.length * 15, 60) // Max 60% from occurrences

  // Adjust based on pattern type and variance
  if (pattern.type === 'fixed-interval') {
    // Fixed intervals are more predictable
    if (pattern.variance! < 15) confidence += 35 // High consistency
    else if (pattern.variance! < 60) confidence += 20 // Medium consistency
    else confidence += 10 // Low consistency
  } else if (pattern.type === 'fixed-time') {
    // Fixed times are also predictable
    if (pattern.variance! < 30) confidence += 30 // High consistency
    else if (pattern.variance! < 120) confidence += 15 // Medium consistency
    else confidence += 5 // Low consistency
  } else {
    // Irregular patterns have lower confidence
    confidence += 5
  }

  return Math.min(confidence, 100)
}

/**
 * Predicts the next restart time based on detected pattern
 */
export function predictNextRestart(
  pattern: RestartPattern | null,
  events: RestartEvent[],
  now: Date = new Date()
): string | null {
  if (!pattern || events.length === 0) return null

  const lastEvent = events[events.length - 1]
  const lastRestartTime = new Date(lastEvent.timestamp)

  if (pattern.type === 'fixed-interval' && pattern.interval) {
    // Calculate next restart based on interval
    const intervalMs = pattern.interval * 60 * 60 * 1000
    const nextRestartTime = new Date(lastRestartTime.getTime() + intervalMs)
    return nextRestartTime.toISOString()
  } else if (pattern.type === 'fixed-time' && pattern.timeOfDay) {
    // Calculate next restart at the fixed time of day
    const [hours, minutes] = pattern.timeOfDay.split(':').map(Number)

    // Start with today at the specified time
    const nextRestart = new Date(now)
    nextRestart.setUTCHours(hours, minutes, 0, 0)

    // If that time has already passed today, use tomorrow
    if (nextRestart <= now) {
      nextRestart.setUTCDate(nextRestart.getUTCDate() + 1)
    }

    return nextRestart.toISOString()
  }

  // For irregular patterns, we can't reliably predict
  return null
}

/**
 * Calculates average downtime from restart events
 */
export function calculateAverageDowntime(events: RestartEvent[]): number {
  if (events.length === 0) return 0
  const totalDowntime = events.reduce((sum, event) => sum + event.downtime, 0)
  return Math.round(totalDowntime / events.length)
}

/**
 * Formats a pattern description for display
 */
export function formatPatternDescription(pattern: RestartPattern | null): string | null {
  if (!pattern) return null

  if (pattern.type === 'fixed-interval' && pattern.interval) {
    const hours = Math.round(pattern.interval)
    if (hours === 1) return 'Every hour'
    if (hours === 24) return 'Daily'
    return `Every ${hours} hours`
  } else if (pattern.type === 'fixed-time' && pattern.timeOfDay) {
    return `Daily at ${pattern.timeOfDay} UTC`
  } else if (pattern.type === 'irregular') {
    return 'Irregular restarts'
  }

  return null
}

/**
 * Main function to predict server restarts from player count data
 */
export function predictServerRestarts(
  data: PlayerCountData[],
  serverId: string,
  now: Date = new Date()
): RestartPrediction {
  // Filter data for this specific server
  const serverData = data.filter(d => d.server_id === serverId)

  // Detect restart events
  const events = detectRestartEvents(serverData)

  // Analyze pattern
  const pattern = analyzeRestartPattern(events)

  // Calculate confidence
  const confidence = calculateConfidence(pattern, events)

  // Predict next restart
  const nextRestartTime = predictNextRestart(pattern, events, now)

  // Get last restart time
  const lastRestartTime = events.length > 0 ? events[events.length - 1].timestamp : null

  // Calculate average downtime
  const averageDowntime = calculateAverageDowntime(events)

  // Format pattern description
  const detectedPattern = formatPatternDescription(pattern)

  return {
    serverId,
    nextRestartTime,
    confidence,
    detectedPattern,
    lastRestartTime,
    averageDowntime,
    detectedEvents: events
  }
}


/**
 * Test file demonstrating the restart prediction algorithm
 * This file shows how the algorithm detects and predicts server restarts
 */

import {
  detectRestartEvents,
  analyzeRestartPattern,
  calculateConfidence,
  predictNextRestart,
  predictServerRestarts,
  formatPatternDescription,
  type PlayerCountData
} from '@/lib/restart-prediction'

// Example 1: Fixed-interval restart pattern (every 6 hours)
const fixedIntervalData: PlayerCountData[] = [
  // Day 1 - 00:00 UTC
  { server_id: 'test1', timestamp: '2024-01-01T00:00:00Z', player_count: 100 },
  { server_id: 'test1', timestamp: '2024-01-01T05:55:00Z', player_count: 95 },
  { server_id: 'test1', timestamp: '2024-01-01T06:00:00Z', player_count: 2 }, // Restart
  { server_id: 'test1', timestamp: '2024-01-01T06:10:00Z', player_count: 50 },
  
  // Day 1 - 12:00 UTC
  { server_id: 'test1', timestamp: '2024-01-01T11:55:00Z', player_count: 98 },
  { server_id: 'test1', timestamp: '2024-01-01T12:00:00Z', player_count: 1 }, // Restart
  { server_id: 'test1', timestamp: '2024-01-01T12:10:00Z', player_count: 45 },
  
  // Day 1 - 18:00 UTC
  { server_id: 'test1', timestamp: '2024-01-01T17:55:00Z', player_count: 102 },
  { server_id: 'test1', timestamp: '2024-01-01T18:00:00Z', player_count: 0 }, // Restart
  { server_id: 'test1', timestamp: '2024-01-01T18:10:00Z', player_count: 48 },
]

// Example 2: Fixed-time restart pattern (daily at 06:00 UTC)
const fixedTimeData: PlayerCountData[] = [
  // Day 1
  { server_id: 'test2', timestamp: '2024-01-01T05:55:00Z', player_count: 120 },
  { server_id: 'test2', timestamp: '2024-01-01T06:00:00Z', player_count: 3 }, // Restart
  { server_id: 'test2', timestamp: '2024-01-01T06:10:00Z', player_count: 55 },
  
  // Day 2
  { server_id: 'test2', timestamp: '2024-01-02T05:55:00Z', player_count: 125 },
  { server_id: 'test2', timestamp: '2024-01-02T06:00:00Z', player_count: 2 }, // Restart
  { server_id: 'test2', timestamp: '2024-01-02T06:10:00Z', player_count: 52 },
  
  // Day 3
  { server_id: 'test2', timestamp: '2024-01-03T05:55:00Z', player_count: 118 },
  { server_id: 'test2', timestamp: '2024-01-03T06:00:00Z', player_count: 1 }, // Restart
  { server_id: 'test2', timestamp: '2024-01-03T06:10:00Z', player_count: 58 },
]

// Example 3: Irregular restart pattern
const irregularData: PlayerCountData[] = [
  { server_id: 'test3', timestamp: '2024-01-01T03:00:00Z', player_count: 100 },
  { server_id: 'test3', timestamp: '2024-01-01T03:05:00Z', player_count: 2 }, // Restart
  { server_id: 'test3', timestamp: '2024-01-01T03:15:00Z', player_count: 45 },
  
  { server_id: 'test3', timestamp: '2024-01-01T11:30:00Z', player_count: 98 },
  { server_id: 'test3', timestamp: '2024-01-01T11:35:00Z', player_count: 1 }, // Restart
  { server_id: 'test3', timestamp: '2024-01-01T11:45:00Z', player_count: 50 },
  
  { server_id: 'test3', timestamp: '2024-01-02T08:00:00Z', player_count: 102 },
  { server_id: 'test3', timestamp: '2024-01-02T08:05:00Z', player_count: 0 }, // Restart
  { server_id: 'test3', timestamp: '2024-01-02T08:15:00Z', player_count: 48 },
]

/**
 * Test function to demonstrate the algorithm
 */
export function testRestartPrediction() {
  console.log('=== Server Restart Prediction Algorithm Test ===\n')

  // Test 1: Fixed-interval pattern
  console.log('Test 1: Fixed-Interval Pattern (Every 6 Hours)')
  console.log('-------------------------------------------')
  const prediction1 = predictServerRestarts(fixedIntervalData, 'test1')
  console.log(`Detected Pattern: ${prediction1.detectedPattern}`)
  console.log(`Confidence: ${prediction1.confidence}%`)
  console.log(`Last Restart: ${prediction1.lastRestartTime}`)
  console.log(`Next Restart: ${prediction1.nextRestartTime}`)
  console.log(`Average Downtime: ${prediction1.averageDowntime} minutes`)
  console.log(`Events Detected: ${prediction1.detectedEvents.length}\n`)

  // Test 2: Fixed-time pattern
  console.log('Test 2: Fixed-Time Pattern (Daily at 06:00 UTC)')
  console.log('-------------------------------------------')
  const prediction2 = predictServerRestarts(fixedTimeData, 'test2')
  console.log(`Detected Pattern: ${prediction2.detectedPattern}`)
  console.log(`Confidence: ${prediction2.confidence}%`)
  console.log(`Last Restart: ${prediction2.lastRestartTime}`)
  console.log(`Next Restart: ${prediction2.nextRestartTime}`)
  console.log(`Average Downtime: ${prediction2.averageDowntime} minutes`)
  console.log(`Events Detected: ${prediction2.detectedEvents.length}\n`)

  // Test 3: Irregular pattern
  console.log('Test 3: Irregular Pattern')
  console.log('-------------------------------------------')
  const prediction3 = predictServerRestarts(irregularData, 'test3')
  console.log(`Detected Pattern: ${prediction3.detectedPattern}`)
  console.log(`Confidence: ${prediction3.confidence}%`)
  console.log(`Last Restart: ${prediction3.lastRestartTime}`)
  console.log(`Next Restart: ${prediction3.nextRestartTime}`)
  console.log(`Average Downtime: ${prediction3.averageDowntime} minutes`)
  console.log(`Events Detected: ${prediction3.detectedEvents.length}\n`)

  console.log('=== Test Complete ===')
}

// Export for testing
export { fixedIntervalData, fixedTimeData, irregularData }


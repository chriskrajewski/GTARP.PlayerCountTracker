# Restart Predictions Implementation Guide

## Overview

This document describes the implementation of ML-powered server restart predictions in the admin panel's server management interface. The feature provides real-time countdown displays and detailed prediction analytics for each server.

## Architecture

### Components

#### 1. **useRestartPredictions Hook** (`hooks/use-restart-predictions.ts`)
- **Purpose**: Manages fetching and auto-refreshing restart prediction data
- **Features**:
  - Auto-refresh every 60 seconds (configurable)
  - Caches predictions in component state
  - Provides `getPrediction(serverId)` method for easy lookup
  - Manual refresh capability
  - Error handling and loading states
  - Stale data detection

**Usage**:
```typescript
const { getPrediction, refresh, loading, error } = useRestartPredictions(
  serverIds,
  60000,  // auto-refresh interval in ms
  true    // enabled
);

const prediction = getPrediction('server-id');
```

#### 2. **RestartCountdown Component** (`components/restart-prediction-countdown.tsx`)
- **Purpose**: Displays countdown to next restart on main server card
- **Features**:
  - Live countdown timer (updates every second)
  - Confidence level indicator with color coding:
    - 🟢 Green (75%+): High confidence
    - 🟡 Yellow (50-74%): Medium confidence
    - 🟠 Orange (25-49%): Low confidence
    - 🔴 Red (<25%): No confidence
  - Progress bar reflecting confidence percentage
  - Stale data indicator
  - Responsive design

**Props**:
```typescript
interface RestartCountdownProps {
  nextRestartTime: string | null;
  confidence: number;
  isStale?: boolean;
  className?: string;
}
```

#### 3. **RestartPredictionsTab Component** (`components/restart-predictions-tab.tsx`)
- **Purpose**: Detailed prediction information in server edit dialog
- **Features**:
  - **Next Predicted Restart Card**: Shows restart time and time remaining
  - **Detected Pattern Section**: Pattern type and description with ML reasoning
  - **Restart Statistics**: 
    - Last restart time
    - Average downtime per restart
    - Number of detected events
    - Cache age
  - **Visual Timeline**: Graphical representation of detected restart events
  - **Refresh Button**: Manual prediction refresh
  - **Stale Data Warning**: Alerts when predictions are older than 30 minutes

**Props**:
```typescript
interface RestartPredictionsTabProps {
  prediction: RestartPrediction | undefined;
  loading?: boolean;
  onRefresh?: () => Promise<void>;
  className?: string;
}
```

### Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│ Server Management Panel                                     │
│                                                             │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ useRestartPredictions Hook                           │   │
│ │ - Fetches from /api/restart-prediction               │   │
│ │ - Auto-refreshes every 60s                           │   │
│ │ - Caches predictions in state                        │   │
│ └──────────────────────────────────────────────────────┘   │
│                          │                                  │
│         ┌────────────────┼────────────────┐                │
│         │                │                │                │
│    ┌────▼─────┐    ┌────▼──────┐    ┌───▼──────┐          │
│    │ Main Card│    │Edit Dialog │    │ Timeline │          │
│    │Countdown │    │  Details   │    │Component │          │
│    └──────────┘    └────────────┘    └──────────┘          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Integration Points

### 1. Server Management Panel (`components/admin/server-management-panel.tsx`)

**Main Card Display**:
```tsx
<RestartCountdown
  nextRestartTime={getPrediction(server.server_id)?.nextRestartTime || null}
  confidence={getPrediction(server.server_id)?.confidence || 0}
  isStale={getPrediction(server.server_id)?.isStale}
/>
```

**Edit Dialog Tab**:
```tsx
<TabsTrigger value="predictions" className="text-white">
  Restart Predictions
</TabsTrigger>

<TabsContent value="predictions" className="space-y-4 mt-4">
  <RestartPredictionsTab
    prediction={getPrediction(editingServer.server_id)}
    onRefresh={refreshPredictions}
  />
</TabsContent>
```

### 2. API Endpoint (`app/api/restart-prediction/route.ts`)

The component integrates with the existing REST API:
- **Endpoint**: `GET /api/restart-prediction?serverIds=id1,id2,...`
- **Response**: Array of `RestartPrediction` objects with ML reasoning
- **Cache**: Predictions are cached in the database and refreshed every 15 minutes by a cron job

## Data Structures

### RestartPrediction Interface
```typescript
interface RestartPrediction {
  serverId: string;
  nextRestartTime: string | null;
  confidence: number;                    // 0-100
  detectedPattern: string | null;        // e.g., "Every 24 hours"
  lastRestartTime: string | null;
  averageDowntime: number;               // minutes
  detectedEvents: never[];
  patternType?: 'fixed-interval' | 'fixed-time' | 'irregular' | 'insufficient-data';
  mlReasoning?: string;                  // ML explanation
  isStale?: boolean;
  cachedAt?: string;
  detectedEventsCount?: number;
}
```

## Features

### 1. Real-Time Countdown
- Updates every second
- Shows time remaining until next restart
- Displays "Restarting now..." when time has passed
- Handles edge cases (no prediction, stale data)

### 2. Confidence Visualization
- Color-coded confidence levels
- Progress bar showing confidence percentage
- Confidence level description (High/Medium/Low/None)

### 3. ML Reasoning Display
- Shows the machine learning model's reasoning
- Displays detected pattern type
- Shows pattern description in human-readable format
- Includes statistics about detected events

### 4. Auto-Refresh
- Predictions auto-refresh every 60 seconds
- Manual refresh button available
- Stale data detection (>30 minutes)
- Loading states during refresh

### 5. Visual Timeline
- Graphical representation of detected restart events
- Shows up to 5 most recent events
- Indicates additional events if more than 5 detected

## Usage Examples

### Basic Usage in Component
```tsx
import { useRestartPredictions } from '@/hooks/use-restart-predictions';
import { RestartCountdown } from '@/components/restart-prediction-countdown';
import { RestartPredictionsTab } from '@/components/restart-predictions-tab';

export function MyComponent() {
  const serverIds = ['server1', 'server2', 'server3'];
  const { getPrediction, refresh } = useRestartPredictions(serverIds);

  return (
    <>
      {/* Display countdown on main card */}
      <RestartCountdown
        nextRestartTime={getPrediction('server1')?.nextRestartTime}
        confidence={getPrediction('server1')?.confidence || 0}
      />

      {/* Display details in dialog */}
      <RestartPredictionsTab
        prediction={getPrediction('server1')}
        onRefresh={refresh}
      />
    </>
  );
}
```

## Performance Considerations

1. **Auto-Refresh Interval**: Set to 60 seconds to balance freshness with API load
2. **Caching**: Predictions are cached in component state to avoid unnecessary re-renders
3. **Memoization**: Components use `useCallback` for stable function references
4. **Lazy Loading**: Predictions only fetched when component mounts
5. **Stale Data Detection**: Automatically detects and warns about stale predictions

## Error Handling

- **No Prediction Available**: Displays "No prediction available" message
- **API Errors**: Falls back to empty state with error message
- **Stale Data**: Shows warning banner when data is older than 30 minutes
- **Network Issues**: Graceful degradation with retry capability

## Testing

### Manual Testing Checklist
- [ ] Countdown updates every second
- [ ] Confidence level colors change correctly
- [ ] Auto-refresh works every 60 seconds
- [ ] Manual refresh button works
- [ ] Stale data warning appears after 30 minutes
- [ ] Timeline displays correctly
- [ ] ML reasoning is readable
- [ ] All tabs in edit dialog work
- [ ] Responsive on mobile devices
- [ ] No console errors

### API Testing
```bash
# Test the API endpoint
curl 'http://localhost:3000/api/restart-prediction?serverIds=server1,server2'

# Expected response
{
  "predictions": [
    {
      "serverId": "server1",
      "nextRestartTime": "2026-01-01T04:00:00Z",
      "confidence": 85,
      "detectedPattern": "Every 24 hours",
      "patternType": "fixed-interval",
      "mlReasoning": "Based on 5 detected restart events...",
      ...
    }
  ],
  "source": "cache",
  "timestamp": "2026-01-01T16:03:09.464Z"
}
```

## Future Enhancements

1. **Prediction History**: Show historical accuracy of predictions
2. **Alerts**: Notify admins before predicted restart
3. **Customization**: Allow admins to adjust prediction parameters
4. **Export**: Export prediction data for analysis
5. **Webhooks**: Send predictions to external systems
6. **Advanced Analytics**: Show prediction trends over time

## Troubleshooting

### Predictions Not Updating
1. Check if cron job is running: `SELECT * FROM server_restart_predictions ORDER BY updated_at DESC LIMIT 1;`
2. Verify API endpoint is accessible: `curl http://localhost:3000/api/restart-prediction?serverIds=test`
3. Check browser console for errors
4. Verify server IDs are correct

### Stale Data Warning
- Predictions are refreshed every 15 minutes by the cron job
- If warning persists, check the cron job logs
- Manual refresh button can be used to force update

### Confidence Always 0
- Ensure at least 2 restart events have been detected
- Check if player count data is being collected
- Verify restart detection algorithm is working correctly

## Files Modified

- `components/admin/server-management-panel.tsx` - Added countdown display and predictions tab
- `components/restart-prediction-countdown.tsx` - New component for countdown display
- `components/restart-predictions-tab.tsx` - New component for detailed predictions
- `hooks/use-restart-predictions.ts` - New hook for managing prediction data

## Commit Information

- **Commit Hash**: 98f64a4
- **Date**: 2026-01-01
- **Message**: feat: Add ML-powered restart prediction display to admin server management

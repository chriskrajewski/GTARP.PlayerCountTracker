import { TimeRange } from "@/lib/data";

/**
 * Format a timestamp based on the selected time range
 */
export function formatDate(timestamp: number, timeRange: TimeRange): string {
  const date = new Date(timestamp);
  
  if (timeRange === "1h" || timeRange === "8h") {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit'
    });
  } else if (timeRange === "24h") {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit'
    });
  } else if (timeRange === "7d") {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  } else if (timeRange === "30d" || timeRange === "90d") {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  } else {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric'
    });
  }
} 
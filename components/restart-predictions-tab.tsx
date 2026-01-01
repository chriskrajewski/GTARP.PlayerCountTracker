"use client";

import { useState, useEffect } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Clock,
  TrendingUp,
  Zap,
  RefreshCw,
  Calendar,
  Hourglass,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RestartEventsTimeline } from '@/components/restart-events-timeline';
import { cn } from '@/lib/utils';
import { formatToLocalTimezone } from '@/lib/timezone-utils';
import type { RestartPrediction } from '@/hooks/use-restart-predictions';

interface RestartPredictionsTabProps {
  prediction: RestartPrediction | undefined;
  loading?: boolean;
  onRefresh?: () => Promise<void>;
  className?: string;
}

/**
 * Gets confidence level description
 */
function getConfidenceLevel(confidence: number): 'high' | 'medium' | 'low' | 'none' {
  if (confidence >= 75) return 'high';
  if (confidence >= 50) return 'medium';
  if (confidence >= 25) return 'low';
  return 'none';
}

/**
 * Gets confidence level color and icon
 */
function getConfidenceDisplay(confidence: number) {
  const level = getConfidenceLevel(confidence);
  const colors = {
    high: { bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-400', icon: CheckCircle2 },
    medium: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'text-yellow-400', icon: AlertTriangle },
    low: { bg: 'bg-orange-500/10', border: 'border-orange-500/30', text: 'text-orange-400', icon: AlertCircle },
    none: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', icon: AlertCircle },
  };

  return colors[level];
}

/**
 * Formats a date for display
 */
function formatDate(dateString: string | null): string {
  if (!dateString) return 'Unknown';
  return formatToLocalTimezone(dateString, 'full');
}

/**
 * Formats time difference for display
 */
function formatTimeDifference(dateString: string | null): string {
  if (!dateString) return 'Unknown';

  const targetDate = new Date(dateString);
  const now = new Date();
  const diff = targetDate.getTime() - now.getTime();

  if (diff <= 0) {
    return 'Restarting now...';
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) {
    return `in ${days}d ${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `in ${hours}h ${minutes}m`;
  } else {
    return `in ${minutes}m`;
  }
}

/**
 * Formats time since for display
 */
function formatTimeSince(dateString: string | null): string {
  if (!dateString) return 'Unknown';

  const pastDate = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - pastDate.getTime();

  if (diff <= 0) {
    return 'Just now';
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) {
    return `${days}d ${hours}h ago`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m ago`;
  } else {
    return `${minutes}m ago`;
  }
}

/**
 * Detailed restart predictions tab with timeline visualization
 */
export function RestartPredictionsTab({
  prediction,
  loading = false,
  onRefresh,
  className,
}: RestartPredictionsTabProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<string>('');

  // Update countdown timer
  useEffect(() => {
    if (!prediction?.nextRestartTime) {
      setTimeRemaining('No prediction');
      return;
    }

    const updateCountdown = () => {
      setTimeRemaining(formatTimeDifference(prediction.nextRestartTime));
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [prediction?.nextRestartTime]);

  const handleRefresh = async () => {
    if (!onRefresh) return;
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  if (!prediction) {
    return (
      <div className={cn('space-y-4', className)}>
        <Card className="bg-[#1a1a1e] border-[#26262c]">
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 text-[#ADADB8] mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">No Prediction Available</h3>
            <p className="text-[#ADADB8] mb-4">
              Waiting for the ML model to generate a prediction. This typically happens every 15 minutes.
            </p>
            {onRefresh && (
              <Button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="bg-[#9147ff] hover:bg-[#772ce8] text-white"
              >
                {isRefreshing ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Refreshing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh Now
                  </>
                )}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const confidenceDisplay = getConfidenceDisplay(prediction.confidence);
  const ConfidenceIcon = confidenceDisplay.icon;

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header with Refresh Button */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Restart Prediction Details</h3>
        {onRefresh && (
          <Button
            onClick={handleRefresh}
            disabled={isRefreshing}
            size="sm"
            variant="outline"
            className="bg-[#26262c] border-[#40404a] text-white hover:bg-[#333339]"
          >
            {isRefreshing ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Refreshing...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </>
            )}
          </Button>
        )}
      </div>

      {/* Stale Data Warning */}
      {prediction.isStale && (
        <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-start space-x-3">
          <AlertTriangle className="h-5 w-5 text-yellow-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-yellow-400">Stale Prediction Data</p>
            <p className="text-xs text-yellow-300/80">
              This prediction was last updated {prediction.cachedAt ? formatTimeSince(prediction.cachedAt) : 'unknown'}. 
              Consider refreshing for the latest data.
            </p>
          </div>
        </div>
      )}

      {/* Main Prediction Card */}
      <Card className={cn('bg-[#1a1a1e] border-[#26262c]', confidenceDisplay.bg, confidenceDisplay.border)}>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-white flex items-center space-x-2">
                <Clock className="h-5 w-5 text-[#9147ff]" />
                <span>Next Predicted Restart</span>
              </CardTitle>
              <CardDescription className="text-[#ADADB8]">
                Based on ML analysis of historical restart patterns
              </CardDescription>
            </div>
            <div className={cn('flex items-center space-x-2 px-3 py-1 rounded-lg', confidenceDisplay.bg, confidenceDisplay.border, 'border')}>
              <ConfidenceIcon className={cn('h-4 w-4', confidenceDisplay.text)} />
              <span className={cn('text-sm font-semibold', confidenceDisplay.text)}>
                {prediction.confidence}% Confidence
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {prediction.nextRestartTime ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#26262c]/50 rounded-lg p-4">
                  <p className="text-xs text-[#ADADB8] mb-1">Restart Time (UTC)</p>
                  <p className="text-sm font-mono text-white">{formatDate(prediction.nextRestartTime)}</p>
                </div>
                <div className="bg-[#26262c]/50 rounded-lg p-4">
                  <p className="text-xs text-[#ADADB8] mb-1">Time Remaining</p>
                  <p className="text-sm font-semibold text-[#9147ff]">{timeRemaining}</p>
                </div>
              </div>
            </>
          ) : (
            <div className="p-4 bg-[#26262c]/50 rounded-lg text-center">
              <p className="text-sm text-[#ADADB8]">Unable to predict next restart time</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pattern Information */}
      <Card className="bg-[#1a1a1e] border-[#26262c]">
        <CardHeader>
          <CardTitle className="text-white flex items-center space-x-2">
            <TrendingUp className="h-5 w-5 text-[#9147ff]" />
            <span>Detected Pattern</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-[#ADADB8] mb-2">Pattern Type</p>
              <Badge
                variant="outline"
                className={cn(
                  'text-xs font-medium',
                  prediction.patternType === 'fixed-interval'
                    ? 'border-blue-500/30 text-blue-400'
                    : prediction.patternType === 'fixed-time'
                      ? 'border-purple-500/30 text-purple-400'
                      : prediction.patternType === 'irregular'
                        ? 'border-orange-500/30 text-orange-400'
                        : 'border-[#40404a] text-[#ADADB8]'
                )}
              >
                {prediction.patternType || 'Unknown'}
              </Badge>
            </div>
            <div>
              <p className="text-xs text-[#ADADB8] mb-2">Pattern Description</p>
              <p className="text-sm font-medium text-white">
                {prediction.detectedPattern || 'No pattern detected'}
              </p>
            </div>
          </div>

          <div className="bg-[#26262c]/50 rounded-lg p-4">
            <p className="text-xs text-[#ADADB8] mb-2">ML Reasoning</p>
            <p className="text-sm text-white leading-relaxed">
              {prediction.mlReasoning || 'No reasoning available'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      <Card className="bg-[#1a1a1e] border-[#26262c]">
        <CardHeader>
          <CardTitle className="text-white flex items-center space-x-2">
            <Zap className="h-5 w-5 text-[#9147ff]" />
            <span>Restart Statistics</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Last Restart */}
            <div className="bg-[#26262c]/50 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <Calendar className="h-4 w-4 text-[#9147ff]" />
                <p className="text-xs text-[#ADADB8]">Last Restart</p>
              </div>
              <p className="text-xs font-mono text-white">
                {prediction.lastRestartTime ? formatDate(prediction.lastRestartTime) : 'Unknown'}
              </p>
              <p className="text-xs text-[#ADADB8] mt-1">
                {prediction.lastRestartTime ? formatTimeSince(prediction.lastRestartTime) : '—'}
              </p>
            </div>

            {/* Average Downtime */}
            <div className="bg-[#26262c]/50 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <Hourglass className="h-4 w-4 text-[#9147ff]" />
                <p className="text-xs text-[#ADADB8]">Avg Downtime</p>
              </div>
              <p className="text-sm font-semibold text-white">{prediction.averageDowntime} min</p>
              <p className="text-xs text-[#ADADB8] mt-1">per restart</p>
            </div>

            {/* Events Detected */}
            <div className="bg-[#26262c]/50 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <TrendingUp className="h-4 w-4 text-[#9147ff]" />
                <p className="text-xs text-[#ADADB8]">Events Detected</p>
              </div>
              <p className="text-sm font-semibold text-white">{prediction.detectedEventsCount || 0}</p>
              <p className="text-xs text-[#ADADB8] mt-1">in last 14 days</p>
            </div>

            {/* Cache Age */}
            <div className="bg-[#26262c]/50 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <RefreshCw className="h-4 w-4 text-[#9147ff]" />
                <p className="text-xs text-[#ADADB8]">Cache Age</p>
              </div>
              <p className="text-xs font-mono text-white">
                {prediction.cachedAt ? formatTimeSince(prediction.cachedAt) : 'Unknown'}
              </p>
              <p className="text-xs text-[#ADADB8] mt-1">last updated</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Timeline Visualization */}
      {prediction.detectedEventsCount && prediction.detectedEventsCount > 0 && (
        <RestartEventsTimeline events={prediction.detectedEvents} />
      )}

      {/* Info Box */}
      <div className="p-4 bg-[#26262c]/30 border border-[#40404a]/30 rounded-lg">
        <p className="text-xs text-[#ADADB8] leading-relaxed">
          <strong>Note:</strong> Predictions are generated by analyzing historical player count data using machine learning.
          Confidence scores reflect the consistency of detected patterns. Predictions are automatically refreshed every 15 minutes.
        </p>
      </div>
    </div>
  );
}

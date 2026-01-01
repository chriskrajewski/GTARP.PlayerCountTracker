"use client";

import { useState, useEffect } from 'react';
import { Clock, AlertCircle, CheckCircle2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RestartCountdownProps {
  nextRestartTime: string | null;
  confidence: number;
  isStale?: boolean;
  className?: string;
}

/**
 * Formats time remaining until restart
 */
function formatTimeRemaining(targetTime: Date): string {
  const now = new Date();
  const diff = targetTime.getTime() - now.getTime();

  if (diff <= 0) {
    return 'Restarting now...';
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

/**
 * Gets confidence level color
 */
function getConfidenceColor(confidence: number): string {
  if (confidence >= 75) return 'text-green-400';
  if (confidence >= 50) return 'text-yellow-400';
  if (confidence >= 25) return 'text-orange-400';
  return 'text-red-400';
}

/**
 * Gets confidence level icon
 */
function getConfidenceIcon(confidence: number) {
  if (confidence >= 75) return <CheckCircle2 className="h-4 w-4" />;
  if (confidence >= 50) return <AlertTriangle className="h-4 w-4" />;
  return <AlertCircle className="h-4 w-4" />;
}

/**
 * Displays a countdown to the next server restart with confidence indicator
 */
export function RestartCountdown({
  nextRestartTime,
  confidence,
  isStale = false,
  className,
}: RestartCountdownProps) {
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (!nextRestartTime) {
      setTimeRemaining('No prediction');
      return;
    }

    const updateCountdown = () => {
      const targetTime = new Date(nextRestartTime);
      const now = new Date();

      if (targetTime.getTime() <= now.getTime()) {
        setIsExpired(true);
        setTimeRemaining('Restarting now...');
      } else {
        setIsExpired(false);
        setTimeRemaining(formatTimeRemaining(targetTime));
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [nextRestartTime]);

  if (!nextRestartTime) {
    return (
      <div className={cn('flex items-center space-x-2 text-[#ADADB8]', className)}>
        <AlertCircle className="h-4 w-4" />
        <span className="text-sm">No prediction available</span>
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Clock className={cn('h-4 w-4', isExpired ? 'text-red-400' : 'text-[#9147ff]')} />
          <span className="text-sm font-medium text-white">Next Restart</span>
        </div>
        <div className={cn('flex items-center space-x-1', getConfidenceColor(confidence))}>
          {getConfidenceIcon(confidence)}
          <span className="text-xs font-medium">{confidence}%</span>
        </div>
      </div>

      <div className="flex items-center justify-between bg-[#26262c]/50 rounded px-3 py-2">
        <span className={cn('text-sm font-semibold', isExpired ? 'text-red-400' : 'text-white')}>
          {timeRemaining}
        </span>
        {isStale && (
          <span className="text-xs text-[#ADADB8] bg-[#40404a]/50 px-2 py-1 rounded">
            Stale data
          </span>
        )}
      </div>

      <div className="w-full bg-[#40404a]/30 rounded-full h-1.5 overflow-hidden">
        <div
          className={cn(
            'h-full transition-all duration-300',
            confidence >= 75 ? 'bg-green-500' : confidence >= 50 ? 'bg-yellow-500' : 'bg-orange-500'
          )}
          style={{ width: `${confidence}%` }}
        />
      </div>
    </div>
  );
}

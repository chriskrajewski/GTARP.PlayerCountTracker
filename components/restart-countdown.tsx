'use client'

import { useState, useEffect, memo } from 'react'
import { motion } from 'motion/react'
import { AlertTriangle, Clock, TrendingDown } from 'lucide-react'
import { RestartPrediction } from '@/lib/restart-prediction'
import { springs } from '@/lib/motion'

interface RestartCountdownProps {
  prediction: RestartPrediction | null
  loading?: boolean
}

/**
 * Formats milliseconds into a human-readable countdown string
 */
function formatCountdown(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`
  } else {
    return `${seconds}s`
  }
}

/**
 * Determines the urgency level based on time remaining
 */
function getUrgencyLevel(milliseconds: number): 'upcoming' | 'imminent' | 'very-soon' {
  const hours = milliseconds / (1000 * 60 * 60)

  if (hours > 1) return 'upcoming'
  if (hours > 0.25) return 'imminent' // 15 minutes
  return 'very-soon'
}

/**
 * Gets the color and styling based on urgency
 */
function getUrgencyStyles(urgency: 'upcoming' | 'imminent' | 'very-soon') {
  switch (urgency) {
    case 'upcoming':
      return {
        bgColor: 'rgba(0, 217, 255, 0.1)',
        borderColor: 'rgba(0, 217, 255, 0.2)',
        textColor: 'text-cyan-400',
        iconColor: 'text-cyan-400',
        glowColor: 'shadow-cyan-500/20'
      }
    case 'imminent':
      return {
        bgColor: 'rgba(251, 146, 60, 0.1)',
        borderColor: 'rgba(251, 146, 60, 0.2)',
        textColor: 'text-orange-400',
        iconColor: 'text-orange-400',
        glowColor: 'shadow-orange-500/30'
      }
    case 'very-soon':
      return {
        bgColor: 'rgba(239, 68, 68, 0.1)',
        borderColor: 'rgba(239, 68, 68, 0.2)',
        textColor: 'text-red-400',
        iconColor: 'text-red-400',
        glowColor: 'shadow-red-500/40'
      }
  }
}


export const RestartCountdown = memo(function RestartCountdown({
  prediction,
  loading = false
}: RestartCountdownProps) {
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)
  const [urgency, setUrgency] = useState<'upcoming' | 'imminent' | 'very-soon'>('upcoming')

  // Update countdown every second
  useEffect(() => {
    if (!prediction?.nextRestartTime) {
      setTimeRemaining(null)
      return
    }

    const updateCountdown = () => {
      const now = new Date().getTime()
      const restartTime = new Date(prediction.nextRestartTime!).getTime()
      const remaining = restartTime - now

      if (remaining > 0) {
        setTimeRemaining(remaining)
        setUrgency(getUrgencyLevel(remaining))
      } else {
        setTimeRemaining(null)
      }
    }

    // Initial update
    updateCountdown()

    // Update every second
    const interval = setInterval(updateCountdown, 1000)

    return () => clearInterval(interval)
  }, [prediction?.nextRestartTime])

  // Show "learning" state when there is no restart time specified
  if (prediction && !prediction.nextRestartTime) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={springs.snappy}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border backdrop-blur-sm"
        style={{
          background: 'rgba(0, 217, 255, 0.1)',
          borderColor: 'rgba(0, 217, 255, 0.2)'
        }}
      >
        {/* Clock icon */}
        <Clock className="h-4 w-4 text-cyan-400" />

        {/* Learning text */}
        <div className="flex flex-col items-start gap-0.5">
          <span className="text-xs font-bold text-cyan-400">
            learning
          </span>
          <span className="text-[9px] text-gray-500">est. restart</span>
        </div>
      </motion.div>
    )
  }

  // Don't render if no prediction or no countdown time remaining
  if (!prediction || timeRemaining === null) {
    return null
  }

  const urgencyStyles = getUrgencyStyles(urgency)
  const countdownText = formatCountdown(timeRemaining)

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={springs.snappy}
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg border backdrop-blur-sm"
      style={{
        background: urgencyStyles.bgColor,
        borderColor: urgencyStyles.borderColor
      }}
    >
      {/* Icon with pulse animation for very-soon state */}
      <motion.div
        animate={urgency === 'very-soon' ? {
          scale: [1, 1.15, 1],
          opacity: [1, 0.8, 1]
        } : {}}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: 'easeInOut'
        }}
        className={`flex-shrink-0 ${urgencyStyles.iconColor}`}
      >
        {urgency === 'very-soon' ? (
          <AlertTriangle className="h-4 w-4" />
        ) : (
          <Clock className="h-4 w-4" />
        )}
      </motion.div>

      {/* Countdown text */}
      <div className="flex flex-col items-start gap-0.5">
        <motion.span
          key={countdownText}
          initial={{ opacity: 0, y: -2 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className={`text-xs font-bold ${urgencyStyles.textColor}`}
        >
          {countdownText}
        </motion.span>
        <span className="text-[9px] text-gray-500">est. restart</span>
      </div>
    </motion.div>
  )
})

RestartCountdown.displayName = 'RestartCountdown'


"use client"

import { motion } from "motion/react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { memo } from "react"

// Animated skeleton with shimmer effect
const AnimatedSkeleton = memo(function AnimatedSkeleton({ 
  className = "", 
  style = {} 
}: { 
  className?: string
  style?: React.CSSProperties 
}) {
  return (
    <motion.div
      className={`relative overflow-hidden rounded-lg ${className}`}
      style={{
        background: 'linear-gradient(135deg, rgba(38, 38, 44, 0.5) 0%, rgba(24, 24, 27, 0.5) 100%)',
        ...style
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Shimmer effect */}
      <motion.div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(0, 217, 255, 0.08) 50%, transparent 100%)',
        }}
        animate={{
          x: ['-100%', '100%'],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: "easeInOut",
          repeatDelay: 0.5
        }}
      />
    </motion.div>
  )
})

// Pulsing dot indicator
const PulsingDot = memo(function PulsingDot({ delay = 0 }: { delay?: number }) {
  return (
    <motion.div
      className="w-2 h-2 rounded-full bg-cyan-500/50"
      animate={{
        scale: [1, 1.5, 1],
        opacity: [0.5, 1, 0.5],
      }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        delay,
      }}
    />
  )
})

// Animated loading text
const LoadingText = memo(function LoadingText() {
  return (
    <motion.div 
      className="flex items-center gap-2 text-cyan-400/70 text-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.5 }}
    >
      <span>Loading dashboard</span>
      <div className="flex gap-1">
        <PulsingDot delay={0} />
        <PulsingDot delay={0.2} />
        <PulsingDot delay={0.4} />
      </div>
    </motion.div>
  )
})

// Skeleton card with animated border
const SkeletonCard = memo(function SkeletonCard({ 
  index = 0,
  children 
}: { 
  index?: number
  children: React.ReactNode 
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        delay: index * 0.1,
        duration: 0.4,
        ease: [0.22, 1, 0.36, 1]
      }}
    >
      <Card className="relative overflow-hidden" animated={false}>
        {/* Animated border glow */}
        <motion.div
          className="absolute inset-0 rounded-xl pointer-events-none"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(0, 217, 255, 0.1), transparent)',
            backgroundSize: '200% 100%',
          }}
          animate={{
            backgroundPosition: ['200% 0', '-200% 0'],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "linear",
          }}
        />
        {children}
      </Card>
    </motion.div>
  )
})

export function DashboardSkeleton() {
  return (
    <motion.div 
      className="space-y-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* Header section */}
      <motion.div 
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex items-center gap-3">
          <AnimatedSkeleton className="h-10 w-48" />
          <LoadingText />
        </div>
        <AnimatedSkeleton className="h-10 w-64" />
      </motion.div>

      {/* Stats cards grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array(3)
          .fill(0)
          .map((_, i) => (
            <SkeletonCard key={i} index={i}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <motion.div
                      className="w-2 h-2 rounded-full bg-cyan-500/30"
                      animate={{ opacity: [0.3, 0.7, 0.3] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                    <AnimatedSkeleton className="h-5 w-32" />
                  </div>
                  <AnimatedSkeleton className="h-8 w-20 rounded-lg" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  {Array(9).fill(0).map((_, j) => (
                    <div key={j} className="space-y-2">
                      <AnimatedSkeleton className="h-3 w-16" />
                      <AnimatedSkeleton className="h-6 w-12" />
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-4 pt-4 border-t border-cyan-500/10">
                  <AnimatedSkeleton className="h-9 flex-1 rounded-lg" />
                  <AnimatedSkeleton className="h-9 w-32 rounded-lg" />
                </div>
              </CardContent>
            </SkeletonCard>
          ))}
      </div>

      {/* Time range tabs */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <AnimatedSkeleton className="h-4 w-24 mb-2" />
        <div className="flex gap-2 overflow-x-auto pb-2">
          {Array(11).fill(0).map((_, i) => (
            <AnimatedSkeleton key={i} className="h-10 w-14 rounded-lg flex-shrink-0" />
          ))}
        </div>
      </motion.div>

      {/* Chart card */}
      <SkeletonCard index={4}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <AnimatedSkeleton className="h-6 w-48" />
            <AnimatedSkeleton className="h-5 w-32" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative h-[400px] w-full">
            {/* Chart loading animation */}
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.div
                className="flex flex-col items-center gap-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
              >
                {/* Animated chart icon */}
                <motion.div
                  className="relative w-16 h-16"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                >
                  <div 
                    className="absolute inset-0 rounded-full border-2 border-cyan-500/20"
                    style={{ borderTopColor: 'rgba(0, 217, 255, 0.6)' }}
                  />
                  <div 
                    className="absolute inset-2 rounded-full border-2 border-teal-500/20"
                    style={{ borderBottomColor: 'rgba(20, 184, 166, 0.6)' }}
                  />
                </motion.div>
                <span className="text-sm text-cyan-400/60">Preparing chart data...</span>
              </motion.div>
            </div>
            
            {/* Fake chart bars */}
            <div className="absolute bottom-0 left-0 right-0 h-64 flex items-end justify-around gap-2 px-8 opacity-20">
              {Array(12).fill(0).map((_, i) => (
                <motion.div
                  key={i}
                  className="w-full bg-gradient-to-t from-cyan-500/30 to-transparent rounded-t"
                  initial={{ height: 0 }}
                  animate={{ 
                    height: `${Math.random() * 80 + 20}%`,
                  }}
                  transition={{
                    delay: i * 0.05,
                    duration: 0.8,
                    ease: [0.22, 1, 0.36, 1]
                  }}
                />
              ))}
            </div>
          </div>
        </CardContent>
      </SkeletonCard>
    </motion.div>
  )
}

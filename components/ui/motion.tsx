"use client"

/**
 * Motion UI Components
 * 
 * Reusable animated components built on top of motion.dev
 * for consistent animations throughout the application.
 */

import * as React from "react"
import { motion, AnimatePresence, useInView, useMotionValue, useSpring, useTransform } from "motion/react"
import { cn } from "@/lib/utils"
import {
  fadeInUp,
  fadeInLeft,
  fadeInRight,
  scaleIn,
  popIn,
  slideInBottom,
  staggerContainer,
  staggerContainerFast,
  buttonInteraction,
  cardHover,
  iconButtonInteraction,
  mobileMenuAnimation,
  menuItemAnimation,
  pageTransition,
  springs,
  numberTransition,
  chartContainer,
  pulseAnimation,
  glowAnimation,
} from "@/lib/motion"

// ============================================================================
// ANIMATED CONTAINERS
// ============================================================================

interface MotionContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  delay?: number
  stagger?: "default" | "fast" | "slow"
}

/**
 * Container that staggers children animations
 */
export function MotionContainer({ 
  children, 
  className,
  delay = 0,
  stagger = "default",
  ...props 
}: MotionContainerProps) {
  const variants = stagger === "fast" ? staggerContainerFast : staggerContainer
  
  return (
    <motion.div
      className={className}
      variants={variants}
      initial="hidden"
      animate="visible"
      exit="exit"
      style={{ willChange: "opacity" }}
      {...props}
    >
      {children}
    </motion.div>
  )
}

// ============================================================================
// ANIMATED ELEMENTS
// ============================================================================

interface MotionDivProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  variant?: "fadeUp" | "fadeLeft" | "fadeRight" | "scale" | "pop" | "slideBottom"
  delay?: number
  duration?: number
  once?: boolean
  amount?: number
}

/**
 * Animated div with various entrance animations
 */
export function MotionDiv({ 
  children, 
  className,
  variant = "fadeUp",
  delay = 0,
  once = true,
  amount = 0.3,
  ...props 
}: MotionDivProps) {
  const ref = React.useRef(null)
  const isInView = useInView(ref, { once, amount })
  
  const variants = {
    fadeUp: fadeInUp,
    fadeLeft: fadeInLeft,
    fadeRight: fadeInRight,
    scale: scaleIn,
    pop: popIn,
    slideBottom: slideInBottom,
  }
  
  return (
    <motion.div
      ref={ref}
      className={className}
      variants={variants[variant]}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      exit="exit"
      style={{ 
        willChange: "opacity, transform",
        transitionDelay: `${delay}s`
      }}
      {...props}
    >
      {children}
    </motion.div>
  )
}

/**
 * Animated item for use inside MotionContainer (inherits stagger)
 */
export function MotionItem({ 
  children, 
  className,
  variant = "fadeUp",
  ...props 
}: Omit<MotionDivProps, "once" | "amount">) {
  const variants = {
    fadeUp: fadeInUp,
    fadeLeft: fadeInLeft,
    fadeRight: fadeInRight,
    scale: scaleIn,
    pop: popIn,
    slideBottom: slideInBottom,
  }
  
  return (
    <motion.div
      className={className}
      variants={variants[variant]}
      style={{ willChange: "opacity, transform" }}
      {...props}
    >
      {children}
    </motion.div>
  )
}

// ============================================================================
// INTERACTIVE ELEMENTS
// ============================================================================

interface MotionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode
  variant?: "default" | "icon"
}

/**
 * Button with hover and tap animations
 */
export const MotionButton = React.forwardRef<HTMLButtonElement, MotionButtonProps>(
  ({ children, className, variant = "default", ...props }, ref) => {
    const interaction = variant === "icon" ? iconButtonInteraction : buttonInteraction
    
    return (
      <motion.button
        ref={ref}
        className={className}
        whileHover={interaction.whileHover}
        whileTap={interaction.whileTap}
        style={{ willChange: "transform" }}
        {...props}
      >
        {children}
      </motion.button>
    )
  }
)
MotionButton.displayName = "MotionButton"

interface MotionCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  hoverEffect?: boolean
  delay?: number
}

/**
 * Card with optional hover lift effect
 */
export function MotionCard({ 
  children, 
  className,
  hoverEffect = true,
  delay = 0,
  ...props 
}: MotionCardProps) {
  return (
    <motion.div
      className={className}
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      exit="exit"
      whileHover={hoverEffect ? cardHover.whileHover : undefined}
      custom={delay}
      style={{ 
        willChange: "opacity, transform, box-shadow",
        transitionDelay: `${delay}s`
      }}
      {...props}
    >
      {children}
    </motion.div>
  )
}

// ============================================================================
// ANIMATED NUMBER COUNTER
// ============================================================================

interface AnimatedNumberProps {
  value: number
  className?: string
  duration?: number
  formatFn?: (value: number) => string
}

/**
 * Smoothly animated number counter
 */
export function AnimatedNumber({ 
  value, 
  className,
  duration = 0.8,
  formatFn = (v) => Math.round(v).toLocaleString()
}: AnimatedNumberProps) {
  const motionValue = useMotionValue(0)
  const springValue = useSpring(motionValue, { 
    stiffness: 100, 
    damping: 20,
    duration 
  })
  const displayValue = useTransform(springValue, (v) => formatFn(v))
  
  React.useEffect(() => {
    motionValue.set(value)
  }, [value, motionValue])
  
  return (
    <motion.span className={className}>
      {displayValue}
    </motion.span>
  )
}

// ============================================================================
// PAGE TRANSITION WRAPPER
// ============================================================================

interface PageTransitionProps {
  children: React.ReactNode
  className?: string
}

/**
 * Wraps page content with entrance/exit animations
 */
export function PageTransition({ children, className }: PageTransitionProps) {
  return (
    <motion.div
      className={className}
      variants={pageTransition}
      initial="hidden"
      animate="visible"
      exit="exit"
      style={{ willChange: "opacity, transform" }}
    >
      {children}
    </motion.div>
  )
}

// ============================================================================
// MOBILE MENU ANIMATION
// ============================================================================

interface MobileMenuProps {
  isOpen: boolean
  children: React.ReactNode
  className?: string
}

/**
 * Animated mobile menu container
 */
export function MobileMenu({ isOpen, children, className }: MobileMenuProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className={className}
          variants={mobileMenuAnimation}
          initial="hidden"
          animate="visible"
          exit="hidden"
          style={{ willChange: "opacity, height", overflow: "hidden" }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/**
 * Animated menu item for use inside MobileMenu
 */
export function MobileMenuItem({ 
  children, 
  className,
  ...props 
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <motion.div
      className={className}
      variants={menuItemAnimation}
      style={{ willChange: "opacity, transform" }}
      {...props}
    >
      {children}
    </motion.div>
  )
}

// ============================================================================
// CHART ANIMATION WRAPPER
// ============================================================================

interface ChartAnimationProps {
  children: React.ReactNode
  className?: string
  loading?: boolean
}

/**
 * Wraps chart components with fade-in animation
 */
export function ChartAnimation({ children, className, loading }: ChartAnimationProps) {
  return (
    <AnimatePresence mode="wait">
      {!loading && (
        <motion.div
          key="chart"
          className={className}
          variants={chartContainer}
          initial="hidden"
          animate="visible"
          exit="hidden"
          style={{ willChange: "opacity, transform" }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ============================================================================
// PULSE INDICATOR
// ============================================================================

interface PulseIndicatorProps {
  className?: string
  color?: string
}

/**
 * Pulsing indicator for live/active states
 */
export function PulseIndicator({ className, color = "#22c55e" }: PulseIndicatorProps) {
  return (
    <motion.div
      className={cn("rounded-full", className)}
      style={{ backgroundColor: color, willChange: "transform, opacity" }}
      variants={pulseAnimation}
      initial="initial"
      animate="animate"
    />
  )
}

// ============================================================================
// GLOW EFFECT
// ============================================================================

interface GlowEffectProps {
  children: React.ReactNode
  className?: string
  active?: boolean
}

/**
 * Adds a glowing effect to children when active
 */
export function GlowEffect({ children, className, active = false }: GlowEffectProps) {
  return (
    <motion.div
      className={className}
      variants={glowAnimation}
      initial="initial"
      animate={active ? "animate" : "initial"}
      style={{ willChange: "box-shadow" }}
    >
      {children}
    </motion.div>
  )
}

// ============================================================================
// PRESENCE WRAPPER
// ============================================================================

interface PresenceProps {
  children: React.ReactNode
  show: boolean
  mode?: "wait" | "sync" | "popLayout"
}

/**
 * Simple presence wrapper for conditional rendering with animations
 */
export function Presence({ children, show, mode = "wait" }: PresenceProps) {
  return (
    <AnimatePresence mode={mode}>
      {show && children}
    </AnimatePresence>
  )
}

// ============================================================================
// LOADING SKELETON WITH ANIMATION
// ============================================================================

interface AnimatedSkeletonProps {
  className?: string
  width?: string | number
  height?: string | number
}

/**
 * Animated skeleton loading placeholder
 */
export function AnimatedSkeleton({ className, width, height }: AnimatedSkeletonProps) {
  return (
    <motion.div
      className={cn("bg-[#26262c] rounded", className)}
      style={{ width, height, willChange: "opacity" }}
      animate={{
        opacity: [0.4, 0.7, 0.4],
      }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        ease: "easeInOut"
      }}
    />
  )
}

// ============================================================================
// STAGGERED LIST
// ============================================================================

interface StaggeredListProps {
  children: React.ReactNode
  className?: string
  staggerDelay?: number
}

/**
 * List container that staggers children animations
 */
export function StaggeredList({ children, className, staggerDelay = 0.08 }: StaggeredListProps) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: staggerDelay,
            delayChildren: 0.1
          }
        }
      }}
    >
      {children}
    </motion.div>
  )
}

// Re-export motion and AnimatePresence for convenience
export { motion, AnimatePresence }

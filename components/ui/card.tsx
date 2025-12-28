"use client"

import * as React from "react"
import { motion } from "motion/react"
import { cn } from "@/lib/utils"

// Animated gradient border component
const GradientBorder = React.memo(function GradientBorder() {
  return (
    <>
      {/* Top gradient line */}
      <div 
        className="absolute top-0 left-0 right-0 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(0, 217, 255, 0.5), transparent)'
        }}
      />
      {/* Animated corner accents */}
      <div className="absolute top-0 left-0 w-8 h-8 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-cyan-400/50 to-transparent" />
        <div className="absolute top-0 left-0 h-full w-px bg-gradient-to-b from-cyan-400/50 to-transparent" />
      </div>
      <div className="absolute top-0 right-0 w-8 h-8 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
        <div className="absolute top-0 right-0 w-full h-px bg-gradient-to-l from-cyan-400/50 to-transparent" />
        <div className="absolute top-0 right-0 h-full w-px bg-gradient-to-b from-cyan-400/50 to-transparent" />
      </div>
    </>
  )
})

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    variant?: "default" | "elevated" | "glass" | "glow"
    animated?: boolean
  }
>(({ className, variant = "default", animated = true, ...props }, ref) => {
  const baseStyles = {
    backgroundColor: 'rgba(14, 14, 16, 0.9)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderColor: 'rgba(0, 217, 255, 0.1)',
    color: '#FFFFFF',
  }

  const variantStyles = {
    default: {
      ...baseStyles,
      boxShadow: '0 4px 24px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.03) inset',
    },
    elevated: {
      ...baseStyles,
      backgroundColor: 'rgba(18, 18, 21, 0.95)',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), 0 0 40px rgba(0, 217, 255, 0.05), 0 0 0 1px rgba(255, 255, 255, 0.05) inset',
    },
    glass: {
      ...baseStyles,
      backgroundColor: 'rgba(14, 14, 16, 0.7)',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.05) inset',
    },
    glow: {
      ...baseStyles,
      boxShadow: '0 4px 24px rgba(0, 0, 0, 0.4), 0 0 30px rgba(0, 217, 255, 0.1), 0 0 0 1px rgba(255, 255, 255, 0.03) inset',
    },
  }

  if (animated) {
    return (
      <motion.div
        ref={ref}
        className={cn(
          "group relative rounded-xl border shadow-sm overflow-hidden",
          className
        )}
        style={variantStyles[variant]}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ 
          type: "spring", 
          stiffness: 200, 
          damping: 25,
          opacity: { duration: 0.3 }
        }}
        whileHover={{
          y: -4,
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.5), 0 0 50px rgba(0, 217, 255, 0.12), 0 0 0 1px rgba(255, 255, 255, 0.08) inset',
          borderColor: 'rgba(0, 217, 255, 0.25)',
          transition: { type: "spring", stiffness: 300, damping: 20 }
        }}
        {...props}
      >
        <GradientBorder />
        {/* Background gradient mesh */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none">
          <div 
            className="absolute -top-1/2 -right-1/2 w-full h-full rounded-full blur-3xl"
            style={{ background: 'radial-gradient(circle, rgba(0, 217, 255, 0.08) 0%, transparent 70%)' }}
          />
        </div>
        {props.children}
      </motion.div>
    )
  }

  return (
    <div
      ref={ref}
      className={cn(
        "group relative rounded-xl border shadow-sm overflow-hidden transition-all duration-300",
        "hover:border-cyan-500/25 hover:-translate-y-1",
        className
      )}
      style={variantStyles[variant]}
      {...props}
    >
      <GradientBorder />
      {props.children}
    </div>
  )
})
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "relative flex flex-col space-y-1.5 p-6 border-b",
      className
    )}
    style={{ 
      borderColor: 'rgba(0, 217, 255, 0.08)',
      background: 'linear-gradient(180deg, rgba(0, 217, 255, 0.03) 0%, transparent 100%)'
    }}
    {...props}
  >
    {/* Subtle header accent line */}
    <div 
      className="absolute bottom-0 left-6 right-6 h-px"
      style={{
        background: 'linear-gradient(90deg, transparent, rgba(0, 217, 255, 0.15), transparent)'
      }}
    />
    {props.children}
  </div>
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "text-2xl font-bold leading-none tracking-tight",
      className
    )}
    style={{ 
      color: '#FFFFFF',
      textShadow: '0 0 30px rgba(0, 217, 255, 0.1)'
    }}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm", className)}
    style={{ color: 'rgba(173, 173, 184, 0.9)' }}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div 
    ref={ref} 
    className={cn("p-6 pt-4 relative", className)} 
    {...props} 
  />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0 border-t relative", className)}
    style={{ 
      borderColor: 'rgba(0, 217, 255, 0.08)',
      background: 'linear-gradient(180deg, transparent 0%, rgba(0, 217, 255, 0.02) 100%)'
    }}
    {...props}
  >
    {/* Subtle footer accent line */}
    <div 
      className="absolute top-0 left-6 right-6 h-px"
      style={{
        background: 'linear-gradient(90deg, transparent, rgba(0, 217, 255, 0.1), transparent)'
      }}
    />
    {props.children}
  </div>
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }

"use client"

import { ReactNode, useEffect, useState } from "react"
import { X, Sparkles } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetClose,
} from "@/components/ui/sheet"
import { motion, AnimatePresence, useMotionValue, useTransform } from "motion/react"

interface SlideoutPanelProps {
  isOpen: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  side?: "left" | "right"
}

// Animated particles for the header
function FloatingParticle({ delay, duration, size, top, left }: { 
  delay: number
  duration: number
  size: number
  top: string
  left: string 
}) {
  return (
    <motion.div
      className="absolute rounded-full bg-gradient-to-r from-cyan-400/30 to-teal-400/30"
      style={{ width: size, height: size, top, left }}
      initial={{ opacity: 0, scale: 0 }}
      animate={{
        opacity: [0, 0.8, 0],
        scale: [0, 1, 0.5],
        y: [0, -30, -60],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: "easeOut",
      }}
    />
  )
}

// Animated grid lines
function GridLines() {
  return (
    <div className="absolute inset-0 overflow-hidden opacity-[0.03]">
      <div className="absolute inset-0" style={{
        backgroundImage: `
          linear-gradient(rgba(6, 182, 212, 0.5) 1px, transparent 1px),
          linear-gradient(90deg, rgba(6, 182, 212, 0.5) 1px, transparent 1px)
        `,
        backgroundSize: '40px 40px',
      }} />
    </div>
  )
}

export function SlideoutPanel({
  isOpen,
  onClose,
  title,
  description,
  children,
  side = "right",
}: SlideoutPanelProps) {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY })
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent 
        side={side}
        hideDefaultClose={true}
        className="p-0 flex flex-col border-0 shadow-none bg-transparent overflow-visible"
        style={{ width: '55vw', maxWidth: '950px' }}
      >
        {/* Main panel container with glass effect */}
        <motion.div
          className="relative flex flex-col h-full overflow-hidden"
          initial={{ x: 100, opacity: 0, scale: 0.95 }}
          animate={{ x: 0, opacity: 1, scale: 1 }}
          exit={{ x: 100, opacity: 0, scale: 0.95 }}
          transition={{ 
            type: "spring", 
            stiffness: 300, 
            damping: 30,
            mass: 0.8
          }}
        >
          {/* Outer glow effect */}
          <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500/20 via-teal-500/10 to-cyan-500/20 rounded-l-3xl blur-xl opacity-60" />
          
          {/* Main background */}
          <div className="absolute inset-0 bg-[#0a0a0c] rounded-l-3xl border-l border-t border-b border-cyan-500/10" />
          
          {/* Animated gradient mesh background */}
          <div className="absolute inset-0 rounded-l-3xl overflow-hidden">
            <motion.div
              className="absolute -top-1/2 -right-1/2 w-full h-full bg-gradient-conic from-cyan-500/10 via-transparent to-teal-500/10 rounded-full blur-3xl"
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            />
            <motion.div
              className="absolute -bottom-1/2 -left-1/2 w-full h-full bg-gradient-conic from-teal-500/10 via-transparent to-cyan-500/10 rounded-full blur-3xl"
              animate={{ rotate: -360 }}
              transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
            />
          </div>

          {/* Grid overlay */}
          <GridLines />

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* HEADER - The showstopper */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          <motion.div
            className="relative z-10 px-8 pt-8 pb-6"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
          >
            {/* Floating particles */}
            <div className="absolute inset-0 overflow-hidden">
              <FloatingParticle delay={0} duration={3} size={4} top="20%" left="10%" />
              <FloatingParticle delay={0.5} duration={4} size={6} top="40%" left="30%" />
              <FloatingParticle delay={1} duration={3.5} size={3} top="60%" left="20%" />
              <FloatingParticle delay={1.5} duration={4.5} size={5} top="30%" left="50%" />
              <FloatingParticle delay={2} duration={3} size={4} top="70%" left="60%" />
            </div>

            <div className="flex items-start justify-between gap-6">
              {/* Title section */}
              <div className="flex-1 space-y-4">
                {/* Animated accent line */}
                <motion.div
                  className="flex items-center gap-3"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2, duration: 0.5 }}
                >
                  <motion.div
                    className="relative"
                    animate={{ rotate: [0, 360] }}
                    transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                  >
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-teal-500 flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-white" />
                    </div>
                    <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-cyan-400 to-teal-500 blur-lg opacity-50" />
                  </motion.div>
                  
                  <motion.div
                    className="h-px flex-1 max-w-24"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ delay: 0.4, duration: 0.8, ease: "easeOut" }}
                    style={{ 
                      background: "linear-gradient(90deg, rgba(6, 182, 212, 0.8), transparent)",
                      transformOrigin: "left"
                    }}
                  />
                </motion.div>

                {/* Title with glitch effect on hover */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3, duration: 0.5 }}
                >
                  <h2 className="text-4xl font-black tracking-tight leading-none">
                    <span className="bg-gradient-to-r from-white via-cyan-100 to-teal-200 bg-clip-text text-transparent drop-shadow-lg">
                      {title}
                    </span>
                  </h2>
                </motion.div>

                {/* Description with typewriter-like reveal */}
                {description && (
                  <motion.p 
                    className="text-base text-cyan-100/60 font-light tracking-wide"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5, duration: 0.5 }}
                  >
                    {description}
                  </motion.p>
                )}
              </div>

              {/* Close button - cyberpunk style */}
              <SheetClose asChild>
                <motion.button
                  className="group relative"
                  initial={{ opacity: 0, scale: 0, rotate: -180 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  transition={{ delay: 0.3, type: "spring", stiffness: 300, damping: 20 }}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  {/* Button glow */}
                  <div className="absolute -inset-2 bg-gradient-to-r from-cyan-500/20 to-teal-500/20 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  
                  {/* Button background */}
                  <div className="relative h-12 w-12 rounded-xl bg-gradient-to-br from-[#1a1a1f] to-[#0f0f12] border border-cyan-500/20 group-hover:border-cyan-400/50 flex items-center justify-center transition-all duration-300 overflow-hidden">
                    {/* Animated border */}
                    <motion.div
                      className="absolute inset-0 rounded-xl"
                      style={{
                        background: "conic-gradient(from 0deg, transparent, rgba(6, 182, 212, 0.3), transparent)",
                      }}
                      animate={{ rotate: 360 }}
                      transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                    />
                    
                    {/* Inner content */}
                    <div className="relative bg-[#0f0f12] rounded-[10px] h-[calc(100%-2px)] w-[calc(100%-2px)] flex items-center justify-center">
                      <X className="h-5 w-5 text-cyan-400/70 group-hover:text-cyan-300 transition-colors duration-300" />
                    </div>
                  </div>
                </motion.button>
              </SheetClose>
            </div>

            {/* Decorative bottom border */}
            <motion.div
              className="absolute bottom-0 left-8 right-8 h-px"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.6, duration: 0.8 }}
              style={{
                background: "linear-gradient(90deg, transparent, rgba(6, 182, 212, 0.3), rgba(20, 184, 166, 0.3), transparent)",
                transformOrigin: "center"
              }}
            />
          </motion.div>

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* CONTENT AREA */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          <motion.div
            className="flex-1 overflow-y-auto relative z-10 px-8 py-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            style={{
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(6, 182, 212, 0.3) transparent'
            }}
          >
            {/* Content wrapper with staggered animation */}
            <AnimatePresence mode="wait">
              <motion.div
                key={isOpen ? "open" : "closed"}
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -40 }}
                transition={{ 
                  duration: 0.5, 
                  ease: [0.22, 1, 0.36, 1],
                  delay: 0.2
                }}
                className="space-y-6"
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </motion.div>

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* FOOTER GLOW */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#0a0a0c] via-[#0a0a0c]/80 to-transparent pointer-events-none z-20 rounded-bl-3xl" />
          
          {/* Bottom accent line */}
          <motion.div
            className="absolute bottom-4 left-8 right-8 h-px z-30"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 0.8, duration: 1 }}
            style={{
              background: "linear-gradient(90deg, transparent, rgba(6, 182, 212, 0.2), transparent)",
              transformOrigin: "center"
            }}
          />
        </motion.div>
      </SheetContent>
    </Sheet>
  )
}

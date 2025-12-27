/**
 * Motion.dev Animation Presets and Utilities
 * 
 * This file contains reusable animation variants, spring configurations,
 * and utility functions for consistent motion throughout the application.
 */

import type { Transition, Variants } from "motion/react"

// ============================================================================
// SPRING CONFIGURATIONS
// ============================================================================

/**
 * Spring presets for different animation feels
 */
export const springs = {
  /** Snappy, responsive spring for quick interactions */
  snappy: { type: "spring", stiffness: 400, damping: 30 } as const,
  
  /** Smooth, gentle spring for larger movements */
  smooth: { type: "spring", stiffness: 200, damping: 25 } as const,
  
  /** Bouncy spring for playful interactions */
  bouncy: { type: "spring", stiffness: 300, damping: 15 } as const,
  
  /** Stiff spring for subtle micro-interactions */
  stiff: { type: "spring", stiffness: 500, damping: 35 } as const,
  
  /** Slow, deliberate spring for dramatic reveals */
  slow: { type: "spring", stiffness: 100, damping: 20 } as const,
} satisfies Record<string, Transition>

// ============================================================================
// EASING CURVES
// ============================================================================

export const easings = {
  /** Standard ease out for exits */
  easeOut: [0.22, 1, 0.36, 1] as const,
  
  /** Standard ease in for entrances */
  easeIn: [0.64, 0, 0.78, 0] as const,
  
  /** Smooth ease in-out for state changes */
  easeInOut: [0.65, 0, 0.35, 1] as const,
  
  /** Dramatic entrance curve */
  dramatic: [0.16, 1, 0.3, 1] as const,
  
  /** Sharp, snappy curve */
  sharp: [0.4, 0, 0.2, 1] as const,
}

// ============================================================================
// ANIMATION VARIANTS
// ============================================================================

/**
 * Fade in from bottom - great for page content, cards, modals
 */
export const fadeInUp: Variants = {
  hidden: { 
    opacity: 0, 
    y: 20,
    filter: "blur(4px)"
  },
  visible: { 
    opacity: 1, 
    y: 0,
    filter: "blur(0px)",
    transition: {
      ...springs.smooth,
      opacity: { duration: 0.4 },
      filter: { duration: 0.3 }
    }
  },
  exit: {
    opacity: 0,
    y: -10,
    transition: { duration: 0.2, ease: easings.easeIn }
  }
}

/**
 * Fade in from left - great for side panels, navigation
 */
export const fadeInLeft: Variants = {
  hidden: { 
    opacity: 0, 
    x: -30,
    filter: "blur(4px)"
  },
  visible: { 
    opacity: 1, 
    x: 0,
    filter: "blur(0px)",
    transition: {
      ...springs.smooth,
      opacity: { duration: 0.4 },
      filter: { duration: 0.3 }
    }
  },
  exit: {
    opacity: 0,
    x: -20,
    transition: { duration: 0.2, ease: easings.easeIn }
  }
}

/**
 * Fade in from right - great for side panels, navigation
 */
export const fadeInRight: Variants = {
  hidden: { 
    opacity: 0, 
    x: 30,
    filter: "blur(4px)"
  },
  visible: { 
    opacity: 1, 
    x: 0,
    filter: "blur(0px)",
    transition: {
      ...springs.smooth,
      opacity: { duration: 0.4 },
      filter: { duration: 0.3 }
    }
  },
  exit: {
    opacity: 0,
    x: 20,
    transition: { duration: 0.2, ease: easings.easeIn }
  }
}

/**
 * Scale in - great for modals, popovers, tooltips
 */
export const scaleIn: Variants = {
  hidden: { 
    opacity: 0, 
    scale: 0.9,
    filter: "blur(8px)"
  },
  visible: { 
    opacity: 1, 
    scale: 1,
    filter: "blur(0px)",
    transition: {
      ...springs.snappy,
      opacity: { duration: 0.25 },
      filter: { duration: 0.2 }
    }
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: { duration: 0.15, ease: easings.easeIn }
  }
}

/**
 * Pop in with bounce - great for notifications, badges
 */
export const popIn: Variants = {
  hidden: { 
    opacity: 0, 
    scale: 0.5 
  },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: springs.bouncy
  },
  exit: {
    opacity: 0,
    scale: 0.8,
    transition: { duration: 0.15 }
  }
}

/**
 * Slide in from bottom for mobile menus, drawers
 */
export const slideInBottom: Variants = {
  hidden: { 
    y: "100%",
    opacity: 0
  },
  visible: { 
    y: 0,
    opacity: 1,
    transition: springs.smooth
  },
  exit: {
    y: "100%",
    opacity: 0,
    transition: { duration: 0.25, ease: easings.easeIn }
  }
}

/**
 * Slide in from top for dropdowns, notifications
 */
export const slideInTop: Variants = {
  hidden: { 
    y: "-100%",
    opacity: 0
  },
  visible: { 
    y: 0,
    opacity: 1,
    transition: springs.smooth
  },
  exit: {
    y: "-100%",
    opacity: 0,
    transition: { duration: 0.25, ease: easings.easeIn }
  }
}

/**
 * Collapse/expand for accordions, expandable sections
 */
export const collapse: Variants = {
  hidden: { 
    height: 0,
    opacity: 0,
    overflow: "hidden"
  },
  visible: { 
    height: "auto",
    opacity: 1,
    overflow: "visible",
    transition: {
      height: springs.smooth,
      opacity: { duration: 0.3, delay: 0.1 }
    }
  },
  exit: {
    height: 0,
    opacity: 0,
    overflow: "hidden",
    transition: {
      opacity: { duration: 0.1 },
      height: { duration: 0.25, ease: easings.easeIn }
    }
  }
}

// ============================================================================
// STAGGER CONFIGURATIONS
// ============================================================================

/**
 * Container variants for staggered children animations
 */
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1
    }
  },
  exit: {
    opacity: 0,
    transition: {
      staggerChildren: 0.03,
      staggerDirection: -1
    }
  }
}

/**
 * Fast stagger for many items
 */
export const staggerContainerFast: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.05
    }
  }
}

/**
 * Slow stagger for dramatic effect
 */
export const staggerContainerSlow: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.2
    }
  }
}

// ============================================================================
// MICRO-INTERACTION VARIANTS
// ============================================================================

/**
 * Button hover and tap states
 */
export const buttonInteraction = {
  whileHover: { 
    scale: 1.02,
    transition: springs.stiff
  },
  whileTap: { 
    scale: 0.98,
    transition: { duration: 0.1 }
  }
}

/**
 * Card hover effect with subtle lift
 */
export const cardHover = {
  whileHover: { 
    y: -4,
    boxShadow: "0 12px 40px -12px rgba(0, 77, 97, 0.35)",
    transition: springs.smooth
  }
}

/**
 * Icon button interaction
 */
export const iconButtonInteraction = {
  whileHover: { 
    scale: 1.1,
    rotate: 5,
    transition: springs.bouncy
  },
  whileTap: { 
    scale: 0.9,
    rotate: -5,
    transition: { duration: 0.1 }
  }
}

/**
 * Refresh/spin animation for loading states
 */
export const spinAnimation = {
  animate: {
    rotate: 360,
    transition: {
      duration: 1,
      repeat: Infinity,
      ease: "linear"
    }
  }
}

/**
 * Pulse animation for live indicators
 */
export const pulseAnimation: Variants = {
  initial: { scale: 1, opacity: 1 },
  animate: {
    scale: [1, 1.2, 1],
    opacity: [1, 0.7, 1],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: "easeInOut"
    }
  }
}

/**
 * Glow animation for emphasis
 */
export const glowAnimation: Variants = {
  initial: { 
    boxShadow: "0 0 0 0 rgba(0, 77, 97, 0)" 
  },
  animate: {
    boxShadow: [
      "0 0 0 0 rgba(0, 77, 97, 0)",
      "0 0 20px 4px rgba(0, 77, 97, 0.4)",
      "0 0 0 0 rgba(0, 77, 97, 0)"
    ],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: "easeInOut"
    }
  }
}

// ============================================================================
// NUMBER COUNTER ANIMATION HELPER
// ============================================================================

/**
 * Creates a smooth number counting transition
 */
export const numberTransition = {
  duration: 0.8,
  ease: easings.easeOut
}

// ============================================================================
// CHART ANIMATION VARIANTS
// ============================================================================

/**
 * Chart container fade in
 */
export const chartContainer: Variants = {
  hidden: { 
    opacity: 0,
    scale: 0.98
  },
  visible: { 
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.5,
      ease: easings.easeOut,
      delay: 0.2
    }
  }
}

// ============================================================================
// PAGE TRANSITION VARIANTS
// ============================================================================

/**
 * Page entrance animation
 */
export const pageTransition: Variants = {
  hidden: { 
    opacity: 0,
    y: 20
  },
  visible: { 
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: easings.easeOut,
      staggerChildren: 0.1,
      delayChildren: 0.1
    }
  },
  exit: {
    opacity: 0,
    y: -10,
    transition: {
      duration: 0.2,
      ease: easings.easeIn
    }
  }
}

// ============================================================================
// SKELETON LOADING ANIMATION
// ============================================================================

export const skeletonPulse: Variants = {
  initial: { opacity: 0.4 },
  animate: {
    opacity: [0.4, 0.7, 0.4],
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: "easeInOut"
    }
  }
}

// ============================================================================
// NOTIFICATION/TOAST ANIMATIONS
// ============================================================================

export const toastAnimation: Variants = {
  hidden: { 
    opacity: 0, 
    y: -20,
    scale: 0.95
  },
  visible: { 
    opacity: 1, 
    y: 0,
    scale: 1,
    transition: springs.snappy
  },
  exit: {
    opacity: 0,
    x: 100,
    transition: { duration: 0.2, ease: easings.easeIn }
  }
}

// ============================================================================
// MENU ANIMATIONS
// ============================================================================

export const mobileMenuAnimation: Variants = {
  hidden: { 
    opacity: 0,
    height: 0,
    transition: {
      height: { duration: 0.2 },
      opacity: { duration: 0.15 }
    }
  },
  visible: { 
    opacity: 1,
    height: "auto",
    transition: {
      height: { duration: 0.3, ease: easings.easeOut },
      opacity: { duration: 0.25, delay: 0.1 },
      staggerChildren: 0.05,
      delayChildren: 0.15
    }
  }
}

export const menuItemAnimation: Variants = {
  hidden: { 
    opacity: 0, 
    x: -10 
  },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: springs.snappy
  }
}

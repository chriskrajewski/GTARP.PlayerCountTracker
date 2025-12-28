"use client"

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { motion } from "motion/react"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 relative overflow-hidden",
  {
    variants: {
      variant: {
        default: "",
        destructive: "",
        outline: "",
        secondary: "",
        ghost: "",
        link: "",
        cyber: "",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-9 rounded-lg px-4",
        lg: "h-12 rounded-lg px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  animated?: boolean
}

type ButtonVariant = NonNullable<VariantProps<typeof buttonVariants>["variant"]>

const getButtonStyles = (variantType: ButtonVariant) => {
  const baseStyles: React.CSSProperties = {
    borderRadius: '8px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
  }
  
  switch (variantType) {
    case 'default':
    case 'cyber':
      return { 
        ...baseStyles,
        background: 'linear-gradient(135deg, #00D9FF 0%, #00f0ff 50%, #0099cc 100%)',
        backgroundSize: '200% 200%',
        color: '#000000',
        border: '1px solid transparent',
        boxShadow: '0 4px 20px rgba(0, 217, 255, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1) inset',
      }
    case 'destructive':
      return { 
        ...baseStyles,
        background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
        color: '#FFFFFF',
        border: '1px solid rgba(239, 68, 68, 0.3)',
        boxShadow: '0 4px 20px rgba(239, 68, 68, 0.25)',
      }
    case 'outline':
      return { 
        ...baseStyles,
        backgroundColor: 'transparent',
        color: '#FFFFFF',
        border: '1px solid rgba(0, 217, 255, 0.3)',
        boxShadow: '0 0 0 1px rgba(255, 255, 255, 0.05) inset',
      }
    case 'secondary':
      return { 
        ...baseStyles,
        background: 'linear-gradient(135deg, rgba(24, 24, 27, 0.9) 0%, rgba(18, 18, 21, 0.9) 100%)',
        backdropFilter: 'blur(10px)',
        color: '#FFFFFF',
        border: '1px solid rgba(0, 217, 255, 0.15)',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05) inset',
      }
    case 'ghost':
      return { 
        ...baseStyles,
        backgroundColor: 'transparent',
        color: '#EFEFF1',
        border: '1px solid transparent',
      }
    case 'link':
      return { 
        color: '#00D9FF',
        textDecoration: 'none',
        backgroundColor: 'transparent',
        border: 'none',
      }
    default:
      return { 
        ...baseStyles,
        background: 'linear-gradient(135deg, #00D9FF 0%, #00f0ff 50%, #0099cc 100%)',
        color: '#000000',
        border: '1px solid transparent',
      }
  }
}

const getHoverStyles = (variantType: ButtonVariant): React.CSSProperties => {
  switch (variantType) {
    case 'default':
    case 'cyber':
      return {
        boxShadow: '0 8px 30px rgba(0, 217, 255, 0.4), 0 0 40px rgba(0, 217, 255, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.15) inset',
        transform: 'translateY(-2px)',
      }
    case 'destructive':
      return {
        boxShadow: '0 8px 30px rgba(239, 68, 68, 0.4)',
        transform: 'translateY(-2px)',
      }
    case 'secondary':
      return {
        background: 'linear-gradient(135deg, rgba(38, 38, 44, 0.95) 0%, rgba(28, 28, 32, 0.95) 100%)',
        borderColor: 'rgba(0, 217, 255, 0.35)',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4), 0 0 30px rgba(0, 217, 255, 0.1), 0 0 0 1px rgba(255, 255, 255, 0.08) inset',
      }
    case 'outline':
      return {
        borderColor: 'rgba(0, 217, 255, 0.6)',
        color: '#00D9FF',
        boxShadow: '0 0 20px rgba(0, 217, 255, 0.2), 0 0 0 1px rgba(0, 217, 255, 0.1) inset',
      }
    case 'ghost':
      return {
        backgroundColor: 'rgba(0, 217, 255, 0.1)',
        borderColor: 'rgba(0, 217, 255, 0.2)',
      }
    case 'link':
      return {
        color: '#00f0ff',
        textShadow: '0 0 10px rgba(0, 217, 255, 0.3)',
      }
    default:
      return {}
  }
}

// Shimmer effect component
const ShimmerEffect = () => (
  <span 
    className="absolute inset-0 overflow-hidden pointer-events-none"
    style={{ borderRadius: 'inherit' }}
  >
    <span 
      className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite]"
      style={{
        background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent)',
      }}
    />
  </span>
)

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size, asChild = false, animated = true, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    const [isHovered, setIsHovered] = React.useState(false)
    
    const baseStyle = getButtonStyles(variant as ButtonVariant)
    const hoverStyle = getHoverStyles(variant as ButtonVariant)
    
    const currentStyle = isHovered ? { ...baseStyle, ...hoverStyle } : baseStyle
    
    if (animated && !asChild) {
      return (
        <motion.button
          ref={ref}
          className={cn(buttonVariants({ variant, size, className }))}
          style={currentStyle}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          {...props}
        >
          {(variant === 'default' || variant === 'cyber') && <ShimmerEffect />}
          <span className="relative z-10 flex items-center gap-2">{children}</span>
        </motion.button>
      )
    }
    
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        style={currentStyle}
        ref={ref}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        {...props}
      >
        {(variant === 'default' || variant === 'cyber') && <ShimmerEffect />}
        <span className="relative z-10 flex items-center gap-2">{children}</span>
      </Comp>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }

"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-lg border text-base file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-500 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm transition-all duration-300",
          className
        )}
        style={{ 
          backgroundColor: 'rgba(24, 24, 27, 0.8)', 
          backdropFilter: 'blur(10px)',
          borderColor: 'rgba(38, 38, 44, 0.8)',
          color: '#FFFFFF',
          padding: '0.5rem 0.875rem',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.03)',
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = 'rgba(0, 217, 255, 0.5)';
          e.currentTarget.style.boxShadow = '0 0 0 2px rgba(0, 217, 255, 0.1), 0 0 20px rgba(0, 217, 255, 0.1), 0 2px 8px rgba(0, 0, 0, 0.2)';
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = 'rgba(38, 38, 44, 0.8)';
          e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.03)';
        }}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }

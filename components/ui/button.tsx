import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "",
        destructive: "",
        outline: "",
        secondary: "",
        ghost: "",
        link: "",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
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
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    
    // Define button styles based on variant
    const getButtonStyles = (variantType: ButtonVariant) => {
      const baseStyles = {
        borderRadius: '4px',
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease',
        boxShadow: '0 0 0 1px rgba(0,0,0,0.15)',
      };
      
      switch (variantType) {
        case 'default':
          return { 
            ...baseStyles,
            backgroundColor: '#004D61',
            color: '#FFFFFF',
            border: '1px solid #004D61',
            ':hover': { backgroundColor: '#003a4d' }
          };
        case 'destructive':
          return { 
            ...baseStyles,
            backgroundColor: '#eb0400',
            color: '#FFFFFF',
            border: '1px solid #eb0400',
          };
        case 'outline':
          return { 
            ...baseStyles,
            backgroundColor: 'transparent',
            color: '#FFFFFF',
            border: '1px solid #26262c',
          };
        case 'secondary':
          return { 
            ...baseStyles,
            backgroundColor: '#18181b',
            color: '#FFFFFF',
            border: '1px solid #26262c',
          };
        case 'ghost':
          return { 
            ...baseStyles,
            backgroundColor: 'transparent',
            color: '#EFEFF1',
            border: '1px solid transparent',
          };
        case 'link':
          return { 
            color: '#004D61',
            textDecoration: 'underline',
            backgroundColor: 'transparent',
            border: 'none',
          };
        default:
          return { 
            ...baseStyles,
            backgroundColor: '#004D61',
            color: '#FFFFFF',
            border: '1px solid #004D61',
          };
      }
    };
    
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        style={getButtonStyles(variant as ButtonVariant)}
        ref={ref}
        onMouseOver={(e) => {
          const target = e.currentTarget;
          if (variant === 'default') {
            target.style.backgroundColor = '#003a4d';
          } else if (variant === 'secondary') {
            target.style.backgroundColor = '#26262c';
          } else if (variant === 'outline') {
            target.style.borderColor = '#004D61';
            target.style.color = '#004D61';
          } else if (variant === 'ghost') {
            target.style.backgroundColor = 'rgba(255,255,255,0.08)';
          }
        }}
        onMouseOut={(e) => {
          const target = e.currentTarget;
          const styles = getButtonStyles(variant as ButtonVariant);
          if (variant === 'default') {
            target.style.backgroundColor = '#004D61';
          } else if (variant === 'secondary') {
            target.style.backgroundColor = '#18181b';
          } else if (variant === 'outline') {
            target.style.borderColor = '#26262c';
            target.style.color = '#FFFFFF';
          } else if (variant === 'ghost') {
            target.style.backgroundColor = 'transparent';
          }
        }}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

type ButtonVariant = NonNullable<VariantProps<typeof buttonVariants>["variant"]>

export { Button, buttonVariants }

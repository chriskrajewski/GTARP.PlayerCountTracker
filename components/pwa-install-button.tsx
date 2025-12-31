"use client";

import React from 'react';
import { motion } from 'motion/react';
import { Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePWAInstall } from '@/hooks/use-pwa-install';

/**
 * Standalone PWA Install Button Component
 * 
 * A flexible button component that can be placed anywhere in the UI
 * to trigger PWA installation. Automatically hides when app is installed.
 * 
 * Usage:
 * <PWAInstallButton />
 * <PWAInstallButton variant="outline" size="sm" />
 * <PWAInstallButton className="custom-class" />
 */

interface PWAInstallButtonProps {
  /**
   * Button variant style
   * @default 'default'
   */
  variant?: 'default' | 'outline' | 'ghost' | 'minimal';

  /**
   * Button size
   * @default 'md'
   */
  size?: 'sm' | 'md' | 'lg';

  /**
   * Custom className
   */
  className?: string;

  /**
   * Custom label text
   * @default 'Install App'
   */
  label?: string;

  /**
   * Show icon
   * @default true
   */
  showIcon?: boolean;

  /**
   * Callback when clicked
   */
  onClick?: () => void;

  /**
   * Force show button (for debugging)
   */
  forceShow?: boolean;
}

export const PWAInstallButton = React.memo(function PWAInstallButton({
  variant = 'default',
  size = 'md',
  className,
  label = 'Install App',
  showIcon = true,
  onClick,
  forceShow = false,
}: PWAInstallButtonProps) {
  const { canInstall, isInstalled, isLoading, installApp } = usePWAInstall();

  // Determine if button should be visible
  const isVisible = forceShow || (canInstall && !isInstalled && !isLoading);

  if (!isVisible) return null;

  const handleClick = async () => {
    onClick?.();
    await installApp();
  };

  // Size styles
  const sizeStyles = {
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-6 py-3 text-base gap-2.5',
  };

  // Variant styles
  const variantStyles = {
    default: {
      background: 'linear-gradient(135deg, #00D9FF 0%, #14B8A6 100%)',
      color: '#000',
      className: 'font-semibold',
    },
    outline: {
      background: 'transparent',
      color: '#00D9FF',
      className: 'border border-cyan-400 font-medium hover:bg-cyan-400/10',
    },
    ghost: {
      background: 'transparent',
      color: '#00D9FF',
      className: 'font-medium hover:bg-white/10',
    },
    minimal: {
      background: 'transparent',
      color: '#00D9FF',
      className: 'font-medium',
    },
  };

  const variantStyle = variantStyles[variant];

  return (
    <motion.button
      onClick={handleClick}
      className={cn(
        'inline-flex items-center justify-center rounded-lg transition-all duration-200 font-medium',
        sizeStyles[size],
        variantStyle.className,
        className
      )}
      style={{
        background: variantStyle.background,
        color: variantStyle.color,
      }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      aria-label={label}
    >
      {showIcon && <Download className={size === 'sm' ? 'w-3 h-3' : size === 'md' ? 'w-4 h-4' : 'w-5 h-5'} />}
      <span>{label}</span>
    </motion.button>
  );
});

PWAInstallButton.displayName = 'PWAInstallButton';


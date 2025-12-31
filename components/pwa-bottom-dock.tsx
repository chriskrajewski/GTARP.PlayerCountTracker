"use client";

import React, { memo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Home, 
  Video, 
  History, 
  MessageSquare, 
  Heart,
  Download,
  ClipboardList
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';

/**
 * PWA Bottom Dock Component
 * 
 * A native-app-like bottom navigation dock that appears when the app
 * is running in PWA standalone mode. Provides quick access to main
 * navigation items with smooth animations and haptic-like feedback.
 * 
 * Features:
 * - iOS-style dock with blur backdrop
 * - Active state indicators with glow effects
 * - Safe area inset support for notched devices
 * - Smooth spring animations
 * - Haptic-style tap feedback
 */

interface DockItem {
  id: string;
  label: string;
  icon: React.ElementType;
  href?: string;
  onClick?: () => void;
  isExternal?: boolean;
  accentColor?: string;
}

interface PWABottomDockProps {
  onFeedbackClick?: () => void;
  onChangelogClick?: () => void;
  onExportClick?: () => void;
  className?: string;
}

// Dock item component with animations
const DockItemButton = memo(function DockItemButton({
  item,
  isActive,
  index
}: {
  item: DockItem;
  isActive: boolean;
  index: number;
}) {
  const Icon = item.icon;
  const accentColor = item.accentColor || '#00D9FF';
  
  const content = (
    <motion.div
      className={cn(
        "flex flex-col items-center justify-center gap-0.5 min-w-[60px] py-2 px-2 rounded-xl transition-colors relative",
        isActive 
          ? "text-white" 
          : "text-[#8B8B8B] hover:text-white"
      )}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.92 }}
      // Remove initial animation to prevent position issues on load
      initial={false}
    >
      {/* Active indicator glow */}
      {isActive && (
        <motion.div
          className="absolute inset-0 rounded-xl"
          style={{
            background: `radial-gradient(circle at center, ${accentColor}15 0%, transparent 70%)`,
          }}
          layoutId="dock-active-bg"
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
      )}
      
      {/* Icon container with glow effect */}
      <motion.div
        className="relative z-10"
        animate={isActive ? {
          filter: `drop-shadow(0 0 8px ${accentColor}60)`,
        } : {
          filter: 'none',
        }}
      >
        <Icon 
          className={cn(
            "h-5 w-5 transition-colors duration-200",
            isActive && `text-[${accentColor}]`
          )}
          style={isActive ? { color: accentColor } : undefined}
        />
      </motion.div>
      
      {/* Label */}
      <span 
        className={cn(
          "text-[10px] font-medium transition-colors duration-200 relative z-10",
          isActive && "font-semibold"
        )}
        style={isActive ? { color: accentColor } : undefined}
      >
        {item.label}
      </span>
      
      {/* Active dot indicator */}
      <AnimatePresence>
        {isActive && (
          <motion.div
            className="absolute -bottom-0.5 w-1 h-1 rounded-full"
            style={{ backgroundColor: accentColor }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );

  // External link
  if (item.isExternal && item.href) {
    return (
      <a 
        href={item.href} 
        target="_blank" 
        rel="noopener noreferrer"
        className="outline-none"
      >
        {content}
      </a>
    );
  }

  // Internal navigation
  if (item.href) {
    return (
      <Link href={item.href} className="outline-none">
        {content}
      </Link>
    );
  }

  // Button action
  return (
    <button onClick={item.onClick} className="outline-none">
      {content}
    </button>
  );
});

export const PWABottomDock = memo(function PWABottomDock({
  onFeedbackClick,
  onChangelogClick,
  onExportClick,
  className
}: PWABottomDockProps) {
  const pathname = usePathname();

  // Define dock items
  const dockItems: DockItem[] = [
    {
      id: 'home',
      label: 'Home',
      icon: Home,
      href: '/',
      accentColor: '#00D9FF'
    },
    {
      id: 'streams',
      label: 'Streams',
      icon: Video,
      href: '/multi-stream',
      accentColor: '#14B8A6'
    },
    {
      id: 'changes',
      label: 'Changes',
      icon: History,
      href: '/serverchangelog',
      accentColor: '#A855F7'
    },
    {
      id: 'changelog',
      label: 'Updates',
      icon: ClipboardList,
      onClick: onChangelogClick,
      accentColor: '#F59E0B'
    },
    {
      id: 'feedback',
      label: 'Feedback',
      icon: MessageSquare,
      href: '/feedback',
      accentColor: '#3B82F6'
    },
    {
      id: 'donate',
      label: 'Donate',
      icon: Heart,
      href: 'https://streamelements.com/alantiix/tip',
      isExternal: true,
      accentColor: '#EF4444'
    }
  ];

  // Determine active item based on pathname
  const getIsActive = (item: DockItem) => {
    if (!item.href || item.isExternal) return false;
    if (item.href === '/') return pathname === '/';
    return pathname.startsWith(item.href);
  };

  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 pwa-bottom-dock",
        className
      )}
      style={{
        // z-index higher than slideouts/modals
        zIndex: 9999,
      }}
    >
      {/* Glassmorphism background - extends to very bottom of screen */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(180deg, rgba(18, 18, 22, 0.95) 0%, rgba(8, 8, 10, 0.98) 100%)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          // Extend background below safe area
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          marginBottom: 'calc(-1 * env(safe-area-inset-bottom, 0px))',
        }}
      />
      
      {/* Top border glow - subtle line at top */}
      <div 
        className="absolute top-0 left-0 right-0 h-px"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(0, 217, 255, 0.4) 20%, rgba(20, 184, 166, 0.4) 50%, rgba(0, 217, 255, 0.4) 80%, transparent 100%)'
        }}
      />
      
      {/* Ambient glow effect above dock */}
      <div 
        className="absolute -top-8 left-1/2 -translate-x-1/2 w-64 h-16 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(0, 217, 255, 0.08) 0%, transparent 70%)',
          filter: 'blur(16px)',
        }}
      />

      {/* Dock items container - respects safe area for interactive elements */}
      <div 
        className="relative flex items-center justify-around px-1 py-2"
        style={{
          // Add padding for home indicator so buttons aren't too close to bottom
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 4px)',
        }}
      >
        {dockItems.map((item, index) => (
          <DockItemButton
            key={item.id}
            item={item}
            isActive={getIsActive(item)}
            index={index}
          />
        ))}
      </div>
    </nav>
  );
});


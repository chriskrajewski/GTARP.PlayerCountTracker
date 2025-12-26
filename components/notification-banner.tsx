"use client";

import React, { useState, useEffect } from 'react';
import { X, Info, AlertTriangle, CheckCircle, Megaphone, AlertCircle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Database } from '@/lib/supabase.types';

// Type definitions
type NotificationBanner = Database['public']['Tables']['notification_banners']['Row'];

interface NotificationBannerProps {
  banner: NotificationBanner;
  onDismiss?: (bannerId: number) => void;
  className?: string;
}

// Banner type configurations
const BANNER_CONFIGS = {
  info: {
    icon: Info,
    defaultBg: '#1e40af', // Blue-600
    defaultText: '#ffffff',
    defaultBorder: '#3b82f6', // Blue-500
    defaultIconColor: '#60a5fa', // Blue-400
  },
  warning: {
    icon: AlertTriangle,
    defaultBg: '#d97706', // Amber-600
    defaultText: '#ffffff',
    defaultBorder: '#f59e0b', // Amber-500
    defaultIconColor: '#fbbf24', // Amber-400
  },
  success: {
    icon: CheckCircle,
    defaultBg: '#059669', // Emerald-600
    defaultText: '#ffffff',
    defaultBorder: '#10b981', // Emerald-500
    defaultIconColor: '#34d399', // Emerald-400
  },
  announcement: {
    icon: Megaphone,
    defaultBg: '#7c3aed', // Violet-600
    defaultText: '#ffffff',
    defaultBorder: '#8b5cf6', // Violet-500
    defaultIconColor: '#a78bfa', // Violet-400
  },
  urgent: {
    icon: AlertCircle,
    defaultBg: '#dc2626', // Red-600
    defaultText: '#ffffff',
    defaultBorder: '#ef4444', // Red-500
    defaultIconColor: '#f87171', // Red-400
  },
};

export function NotificationBanner({ banner, onDismiss, className }: NotificationBannerProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [isAnimating, setIsAnimating] = useState(false);

  const config = BANNER_CONFIGS[banner.type as keyof typeof BANNER_CONFIGS];
  const Icon = config.icon;

  // Use custom colors if provided, otherwise use defaults
  const backgroundColor = banner.background_color || config.defaultBg;
  const textColor = banner.text_color || config.defaultText;
  const borderColor = banner.border_color || config.defaultBorder;
  const iconColor = config.defaultIconColor;

  const handleDismiss = async () => {
    if (!banner.is_dismissible) return;

    setIsAnimating(true);
    
    // Call the dismiss callback
    if (onDismiss) {
      onDismiss(banner.id);
    }

    // Animate out after a short delay
    setTimeout(() => {
      setIsVisible(false);
    }, 200);
  };

  const handleActionClick = () => {
    if (banner.action_url) {
      window.open(banner.action_url, banner.action_target || '_self');
    }
  };

  // Don't render if not visible
  if (!isVisible) {
    return null;
  }

  return (
    <div
      className={cn(
        "relative w-full transition-all duration-300 ease-in-out transform",
        isAnimating ? "opacity-0 -translate-y-2 scale-y-95" : "opacity-100 translate-y-0 scale-y-100",
        className
      )}
      style={{
        backgroundColor,
        borderColor,
        color: textColor,
      }}
    >
      {/* Banner Content */}
      <div 
        className="border-l-4 border-r border-t border-b px-4 py-3 shadow-lg"
        style={{ borderLeftColor: borderColor, borderColor: `${borderColor}40` }}
      >
        <div className="flex items-start justify-between gap-3">
          {/* Icon and Content */}
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {/* Icon */}
            <div className="flex-shrink-0 mt-0.5">
              <Icon 
                className="h-5 w-5" 
                style={{ color: iconColor }}
                aria-hidden="true"
              />
            </div>

            {/* Text Content */}
            <div className="flex-1 min-w-0">
              <h3 
                className="font-semibold text-sm mb-1 leading-tight"
                style={{ color: textColor }}
              >
                {banner.title}
              </h3>
              <p 
                className="text-sm opacity-90 leading-relaxed"
                style={{ color: textColor }}
              >
                {banner.message}
              </p>

              {/* Action Button */}
              {banner.action_text && banner.action_url && (
                <div className="mt-3">
                  <Button
                    onClick={handleActionClick}
                    variant="outline"
                    size="sm"
                    className="text-xs font-medium transition-all duration-200 hover:scale-105"
                    style={{
                      backgroundColor: 'transparent',
                      borderColor: textColor,
                      color: textColor,
                    }}
                  >
                    <span>{banner.action_text}</span>
                    {banner.action_target === '_blank' && (
                      <ExternalLink className="ml-1.5 h-3 w-3" />
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Dismiss Button */}
          {banner.is_dismissible && (
            <button
              onClick={handleDismiss}
              className="flex-shrink-0 rounded-md p-1.5 transition-all duration-200 hover:bg-black/10 focus:outline-none focus:ring-2 focus:ring-white/20"
              style={{ color: textColor }}
              aria-label="Dismiss notification"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Priority Indicator (for urgent banners) */}
      {banner.type === 'urgent' && banner.priority >= 8 && (
        <div 
          className="absolute -top-1 -right-1 w-3 h-3 rounded-full animate-pulse"
          style={{ backgroundColor: '#ef4444' }}
          aria-hidden="true"
        />
      )}

      {/* Subtle animation for announcement banners */}
      {banner.type === 'announcement' && (
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `linear-gradient(90deg, transparent, ${backgroundColor}20, transparent)`,
            animation: 'shimmer 3s ease-in-out infinite',
          }}
        />
      )}

      <style jsx>{`
        @keyframes shimmer {
          0%, 100% { transform: translateX(-100%); }
          50% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}

// Component for displaying multiple banners
interface NotificationBannerListProps {
  banners: NotificationBanner[];
  onDismiss?: (bannerId: number) => void;
  maxVisible?: number;
  className?: string;
}

export function NotificationBannerList({ 
  banners, 
  onDismiss, 
  maxVisible = 3,
  className 
}: NotificationBannerListProps) {
  const [visibleBanners, setVisibleBanners] = useState<NotificationBanner[]>([]);

  useEffect(() => {
    // Sort banners by priority (higher priority first) and limit the number shown
    const sortedBanners = [...banners]
      .sort((a, b) => b.priority - a.priority)
      .slice(0, maxVisible);

    setVisibleBanners(sortedBanners);
  }, [banners, maxVisible]);

  const handleBannerDismiss = (bannerId: number) => {
    // Remove banner from visible list immediately for smooth UX
    setVisibleBanners(prev => prev.filter(b => b.id !== bannerId));
    
    // Call parent dismiss handler
    if (onDismiss) {
      onDismiss(bannerId);
    }
  };

  if (visibleBanners.length === 0) {
    return null;
  }

  return (
    <div className={cn("space-y-2", className)}>
      {visibleBanners.map((banner, index) => (
        <NotificationBanner
          key={banner.id}
          banner={banner}
          onDismiss={handleBannerDismiss}
          className={cn(
            "animate-in slide-in-from-top-2 duration-300",
            `delay-${index * 100}`
          )}
        />
      ))}
    </div>
  );
}

// Hook for managing notification banners
export function useNotificationBanners() {
  const [banners, setBanners] = useState<NotificationBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBanners = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/notification-banners');
      
      if (!response.ok) {
        throw new Error('Failed to fetch banners');
      }

      const data = await response.json();
      setBanners(data.banners || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching banners:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setBanners([]);
    } finally {
      setLoading(false);
    }
  };

  const dismissBanner = async (bannerId: number) => {
    try {
      const response = await fetch('/api/notification-banners/dismiss', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ banner_id: bannerId }),
      });

      if (!response.ok) {
        throw new Error('Failed to dismiss banner');
      }

      // Remove banner from local state
      setBanners(prev => prev.filter(b => b.id !== bannerId));
    } catch (err) {
      console.error('Error dismissing banner:', err);
      // Optionally show an error toast here
    }
  };

  useEffect(() => {
    fetchBanners();
  }, []);

  return {
    banners,
    loading,
    error,
    refetch: fetchBanners,
    dismissBanner,
  };
}

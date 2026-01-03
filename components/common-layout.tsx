"use client";

import Link from 'next/link';
import { useState, useEffect, memo } from 'react';
import { ArrowLeft, Download, ClipboardList, MessageSquare, Menu, X, Heart, Bot, Video, History, Sparkles } from 'lucide-react';
import FeedbackForm from '@/components/feedback-form';
import { CSVExport } from '@/components/csv-export';
import ServerResourceChanges from '@/components/server-resource-changes';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { DataStartPopup } from '@/components/data-start-popup';
import { DataRefreshPopup } from '@/components/data-refresh-popup';
import { DataStatusIndicator } from '@/components/data-status-indicator';
import { useFeatureFlag, FEATURE_FLAGS } from '@/lib/feature-flags';
import Image from 'next/image';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { NotificationBannerList, useNotificationBanners } from '@/components/notification-banner';
import mixpanel from "mixpanel-browser";
import { motion, AnimatePresence, MobileMenu, MobileMenuItem, MotionButton } from '@/components/ui/motion';
import { fadeInUp, springs } from '@/lib/motion';
import { SlideoutPanel } from '@/components/slideout-panel';
import { SiteUpdatesPanel } from '@/components/site-updates/site-updates-panel';
import { PWABottomDock } from '@/components/pwa-bottom-dock';
import { usePWAStandalone } from '@/hooks/use-pwa-standalone';
import { cn } from '@/lib/utils';
import { useLiveDataStatus } from '@/components/live-data-status-provider';

// Create an instance of the Mixpanel object, your token is already added to this snippet
      mixpanel.init('13440c630224bb2155944bc8de971af7', {
      autocapture: true,
      record_sessions_percent: 100,
    })

// ═══════════════════════════════════════════════════════════════════════════
// ANIMATED BACKGROUND COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

// Floating particle for header
const FloatingParticle = memo(function FloatingParticle({ 
  delay, 
  duration, 
  size, 
  top, 
  left 
}: { 
  delay: number
  duration: number
  size: number
  top: string
  left: string 
}) {
  return (
    <motion.div
      className="absolute rounded-full"
      style={{ 
        width: size, 
        height: size, 
        top, 
        left,
        background: 'radial-gradient(circle, rgba(0, 217, 255, 0.4) 0%, transparent 70%)'
      }}
      initial={{ opacity: 0, scale: 0 }}
      animate={{
        opacity: [0, 0.6, 0],
        scale: [0, 1.5, 0.5],
        y: [0, -20, -40],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: "easeOut",
      }}
    />
  )
})

// Animated grid overlay
const GridOverlay = memo(function GridOverlay() {
  return (
    <div 
      className="absolute inset-0 pointer-events-none opacity-[0.02]"
      style={{
        backgroundImage: `
          linear-gradient(rgba(0, 217, 255, 0.5) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0, 217, 255, 0.5) 1px, transparent 1px)
        `,
        backgroundSize: '40px 40px',
        maskImage: 'linear-gradient(to bottom, black 0%, transparent 100%)'
      }}
    />
  )
})

// Animated gradient orbs in background
const GradientOrbs = memo(function GradientOrbs() {
  return (
    <>
      <motion.div
        className="absolute -top-20 -left-20 w-40 h-40 rounded-full blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(0, 217, 255, 0.15) 0%, transparent 70%)' }}
        animate={{ 
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -top-10 right-1/4 w-32 h-32 rounded-full blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(20, 184, 166, 0.1) 0%, transparent 70%)' }}
        animate={{ 
          scale: [1.2, 1, 1.2],
          opacity: [0.2, 0.4, 0.2],
        }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />
    </>
  )
})

interface CommonLayoutProps {
  children: React.ReactNode;
  showBackButton?: boolean;
  pageTitle?: string;
  // Optional props for CSV export functionality
  servers?: any[];
  selectedServers?: string[];
  // Live data status props (optional - will use context if not provided)
  timeRange?: string;
  liveDataStatus?: any;
}

// Header button component with consistent styling
const HeaderButton = memo(function HeaderButton({ 
  children, 
  onClick, 
  href,
  variant = "default",
  className = ""
}: { 
  children: React.ReactNode
  onClick?: () => void
  href?: string
  variant?: "default" | "donate"
  className?: string
}) {
  const baseClasses = "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-300 border backdrop-blur-sm"
  const variantClasses = variant === "donate" 
    ? "bg-[#18181b]/80 text-white border-[#26262c] hover:border-[#ff4545]/50 hover:shadow-lg hover:shadow-[#ff4545]/20"
    : "bg-[#18181b]/80 text-white border-[#26262c] hover:border-[#00D9FF]/50 hover:shadow-lg hover:shadow-[#00D9FF]/20"
  
  const content = (
    <motion.span
      className={`${baseClasses} ${variantClasses} ${className}`}
      whileHover={{ scale: 1.02, y: -1 }}
      whileTap={{ scale: 0.98 }}
    >
      {children}
    </motion.span>
  )
  
  if (href) {
    return href.startsWith('http') ? (
      <a href={href} target="_blank" rel="noopener noreferrer">{content}</a>
    ) : (
      <Link href={href}>{content}</Link>
    )
  }
  
  return <button onClick={onClick}>{content}</button>
})

export function CommonLayout({ 
  children, 
  showBackButton = false, 
  pageTitle,
  servers = [],
  selectedServers = [],
  timeRange = "8h",
  liveDataStatus: propLiveDataStatus
}: CommonLayoutProps) {
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showResourceDialog, setShowResourceDialog] = useState(false);
  const [showSiteUpdatesPanel, setShowSiteUpdatesPanel] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Get live data status from context (fallback if not provided via props)
  const { liveDataStatus: contextLiveDataStatus } = useLiveDataStatus();
  const liveDataStatus = propLiveDataStatus || contextLiveDataStatus;
  
  // PWA standalone mode detection
  const { isPWA, isLoading: isPWALoading } = usePWAStandalone();
  
  // Track if we're on mobile for dock visibility
  const [isMobileView, setIsMobileView] = useState(false);
  
  // Debug: Check for URL param to force show dock for testing
  const [forceShowDock, setForceShowDock] = useState(false);
  
  // Feature flags
  const isFeedbackEnabled = useFeatureFlag(FEATURE_FLAGS.FEEDBACK);
  const isSiteUpdatesEnabled = useFeatureFlag(FEATURE_FLAGS.SITE_UPDATES);
  const isServerChangesEnabled = useFeatureFlag(FEATURE_FLAGS.SERVER_CHANGES);
  const isCsvExportEnabled = useFeatureFlag(FEATURE_FLAGS.CSV_EXPORT);
  const isMultiStreamEnabled = useFeatureFlag(FEATURE_FLAGS.MULTI_STREAM);
  
  useEffect(() => {
    const checkMobile = () => setIsMobileView(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    // Check for debug param to force show dock for testing (development only)
    if (process.env.NODE_ENV === 'development') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('pwa_dock') === 'true') {
        setForceShowDock(true);
      }
    }
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // Show dock in PWA mode on mobile, or when debug param is set (dev only)
  const showPWADock = (isPWA && isMobileView && !isPWALoading) || forceShowDock;
  
  // Notification banners - always enabled (not controlled by feature flags)
  const { banners, dismissBanner } = useNotificationBanners();
  


  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setMobileMenuOpen(false);
    if (mobileMenuOpen) {
      document.addEventListener('click', handleClickOutside);
    }
    return () => document.removeEventListener('click', handleClickOutside);
  }, [mobileMenuOpen]);

  return (
    <div className="flex flex-col min-h-screen relative">
      {/* Global animated grid background */}
      <div className="cyber-grid" />
      
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* HEADER - Premium Cyberpunk Design                                   */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <motion.header 
        className="relative text-white px-3 sm:px-4 flex items-center justify-between sticky top-0 z-50 flex-wrap overflow-hidden ios-safe-header"
        style={{ 
          background: 'linear-gradient(180deg, rgba(10, 10, 12, 0.98) 0%, rgba(14, 14, 16, 0.95) 100%)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          minHeight: '60px',
          // iOS Safe Area - add padding top for status bar
          paddingTop: 'max(0.75rem, env(safe-area-inset-top, 0px))',
        }}
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Background effects */}
        <GradientOrbs />
        <GridOverlay />
        
        {/* Floating particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <FloatingParticle delay={0} duration={4} size={4} top="30%" left="5%" />
          <FloatingParticle delay={1} duration={5} size={3} top="50%" left="15%" />
          <FloatingParticle delay={2} duration={4.5} size={5} top="40%" left="85%" />
          <FloatingParticle delay={0.5} duration={6} size={3} top="60%" left="90%" />
        </div>
        
        {/* Bottom border glow */}
        <motion.div 
          className="absolute bottom-0 left-0 right-0 h-px"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, rgba(0, 217, 255, 0.4) 20%, rgba(20, 184, 166, 0.4) 50%, rgba(0, 217, 255, 0.4) 80%, transparent 100%)'
          }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
        />
        
        {/* Left section - Logo and title */}
        <motion.div 
          className="flex items-center gap-2 py-3 relative z-10"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        >
          {showBackButton && (
            <motion.div
              whileHover={{ scale: 1.1, x: -2 }}
              whileTap={{ scale: 0.95 }}
            >
              <Link href="/" className="text-white hover:text-cyan-400 flex items-center justify-center w-8 h-8 rounded-lg bg-[#18181b]/50 border border-[#26262c] hover:border-cyan-500/30 transition-all">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </motion.div>
          )}
          
          {/* Logo with glow effect */}
          <motion.div
            className="relative"
            initial={{ rotate: -10, scale: 0.8 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            whileHover={{ rotate: [0, -5, 5, 0], transition: { duration: 0.5 } }}
          >
            <img 
              src="/pepeRP.webp" 
              alt="pepeRP Logo" 
              className="h-8 w-8 sm:h-10 sm:w-10 relative z-10" 
            />
            {/* Logo glow */}
            <div 
              className="absolute inset-0 blur-lg opacity-50"
              style={{ background: 'radial-gradient(circle, rgba(0, 217, 255, 0.4) 0%, transparent 70%)' }}
            />
          </motion.div>
          
          {/* Title with gradient */}
          <div className="flex flex-col">
            <h1 className="font-bold text-sm sm:text-base flex items-center whitespace-nowrap overflow-hidden text-ellipsis">
              <span 
                className="truncate max-w-[140px] sm:max-w-none bg-gradient-to-r from-white via-cyan-100 to-teal-200 bg-clip-text text-transparent"
                style={{ textShadow: '0 0 30px rgba(0, 217, 255, 0.3)' }}
              >
                {pageTitle || "Discover, Track, and Watch GTA Roleplay"}
              </span>
            </h1>
          </div>
        </motion.div>
        
        {/* Data Status Indicator - Hidden on smallest screens */}
        <motion.div 
          className="hidden sm:flex items-center gap-1 text-xs text-[#ADADB8] ml-2 mr-auto order-3 sm:order-2 relative z-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <DataStatusIndicator 
            isLiveStreaming={liveDataStatus?.isStreaming}
            lastLiveFetch={liveDataStatus?.lastFetch}
            liveLoading={liveDataStatus?.loading}
            timeRange={timeRange}
            activeServerCount={liveDataStatus?.activeServerCount}
            pollingInterval={liveDataStatus?.pollingInterval}
          />
        </motion.div>

        {/* Mobile menu button - Hidden in PWA dock mode */}
        {!showPWADock && (
          <div className="flex items-center sm:hidden order-2 relative z-10">
            <motion.button 
              onClick={(e) => {
                e.stopPropagation();
                setMobileMenuOpen(!mobileMenuOpen);
              }} 
              className="p-2 rounded-lg text-white bg-[#18181b]/80 border border-[#26262c] hover:border-cyan-500/30 transition-all backdrop-blur-sm"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <motion.div
                animate={{ rotate: mobileMenuOpen ? 90 : 0 }}
                transition={{ duration: 0.2 }}
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </motion.div>
            </motion.button>
          </div>
        )}

        {/* Header Buttons - Desktop with stagger animation */}
        <motion.div 
          className="hidden sm:flex items-center gap-2 order-3 relative z-10"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: {
                staggerChildren: 0.05,
                delayChildren: 0.3
              }
            }
          }}
        >
          {isFeedbackEnabled && (
            <motion.div variants={fadeInUp}>
              <FeedbackForm 
                trigger={
                  <HeaderButton>
                    <MessageSquare className="h-3.5 w-3.5" />
                    Feedback
                  </HeaderButton>
                }
              />
            </motion.div>
          )}
          
          {isSiteUpdatesEnabled && (
            <motion.div variants={fadeInUp}>
              <HeaderButton onClick={() => setShowSiteUpdatesPanel(true)}>
                <ClipboardList className="h-3.5 w-3.5" />
                Site Updates
              </HeaderButton>
            </motion.div>
          )}

          {isServerChangesEnabled && (
            <motion.div variants={fadeInUp}>
              <HeaderButton href="/serverchangelog">
                <History className="h-3.5 w-3.5" />
                Server Changes
              </HeaderButton>
            </motion.div>
          )}
          
          {isCsvExportEnabled && (
            <motion.div variants={fadeInUp}>
              <HeaderButton onClick={() => setShowExportDialog(true)}>
                <Download className="h-3.5 w-3.5" />
                CSV Export
              </HeaderButton>
            </motion.div>
          )}
          
          {isMultiStreamEnabled && (
            <motion.div variants={fadeInUp}>
              <HeaderButton href="/multi-stream">
                <Video className="h-3.5 w-3.5" />
                Multi Stream
              </HeaderButton>
            </motion.div>
          )}

          <motion.div variants={fadeInUp}>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HeaderButton href="https://streamelements.com/alantiix/tip" variant="donate">
                    <motion.span
                      animate={{ 
                        scale: [1, 1.2, 1],
                      }}
                      transition={{ 
                        duration: 1.5, 
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                    >
                      <Heart className="h-3.5 w-3.5 text-[#ff4545]" />
                    </motion.span>
                    Donate
                  </HeaderButton>
                </TooltipTrigger>
                <TooltipContent className="bg-[#18181b] text-white border-[#26262c]">
                  Buy me a cup of coffee :)
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </motion.div>
        </motion.div>
        
        {/* Mobile menu - Expanded with Animation (Hidden in PWA dock mode) */}
        {!showPWADock && (
          <MobileMenu isOpen={mobileMenuOpen} className="w-full py-3 sm:hidden order-4">
          <div 
            onClick={(e) => e.stopPropagation()}
            className="relative"
          >
            {/* Mobile menu background glow */}
            <div 
              className="absolute inset-0 rounded-lg opacity-50"
              style={{ 
                background: 'linear-gradient(180deg, rgba(0, 217, 255, 0.03) 0%, transparent 100%)',
              }}
            />
            
            <div className="flex flex-col gap-2 relative z-10">
              {/* Mobile Data info */}
              <MobileMenuItem className="flex items-center gap-1 text-xs text-[#ADADB8] px-3 py-2 bg-[#18181b]/50 rounded-lg border border-[#26262c]">
                <DataStatusIndicator 
                  isLiveStreaming={liveDataStatus?.isStreaming}
                  lastLiveFetch={liveDataStatus?.lastFetch}
                  liveLoading={liveDataStatus?.loading}
                  timeRange={timeRange}
                  activeServerCount={liveDataStatus?.activeServerCount}
                  pollingInterval={liveDataStatus?.pollingInterval}
                />
              </MobileMenuItem>
              
              <div className="h-px bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent my-1" />
              
              {/* Mobile action buttons */}
              <div className="flex flex-col gap-2 px-1">
                {isFeedbackEnabled && (
                  <MobileMenuItem>
                    <Link 
                      href="/feedback" 
                      className="flex w-full items-center gap-2 px-4 py-2.5 bg-[#18181b]/80 text-white rounded-lg border border-[#26262c] hover:border-cyan-500/30 transition-all text-sm font-medium backdrop-blur-sm"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <MessageSquare className="h-4 w-4 text-cyan-400" />
                      Feedback
                    </Link>
                  </MobileMenuItem>
                )}
                
                {isSiteUpdatesEnabled && (
                  <MobileMenuItem>
                    <button 
                      onClick={() => {
                        setShowSiteUpdatesPanel(true);
                        setMobileMenuOpen(false);
                      }}
                      className="flex w-full items-center gap-2 px-4 py-2.5 bg-[#18181b]/80 text-white rounded-lg border border-[#26262c] hover:border-cyan-500/30 transition-all text-sm font-medium backdrop-blur-sm"
                    >
                      <ClipboardList className="h-4 w-4 text-cyan-400" />
                      Site Updates
                    </button>
                  </MobileMenuItem>
                )}

                {isServerChangesEnabled && (
                  <MobileMenuItem>
                    <Link 
                      href="/serverchangelog" 
                      className="flex w-full items-center gap-2 px-4 py-2.5 bg-[#18181b]/80 text-white rounded-lg border border-[#26262c] hover:border-cyan-500/30 transition-all text-sm font-medium backdrop-blur-sm"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <History className="h-4 w-4 text-cyan-400" />
                      Server Changes
                    </Link>
                  </MobileMenuItem>
                )}
                
               {isCsvExportEnabled && (
                  <MobileMenuItem>
                    <button 
                      onClick={() => {
                        setShowExportDialog(true);
                        setMobileMenuOpen(false);
                      }}
                      className="flex w-full items-center gap-2 px-4 py-2.5 bg-[#18181b]/80 text-white rounded-lg border border-[#26262c] hover:border-cyan-500/30 transition-all text-sm font-medium backdrop-blur-sm"
                    >
                      <Download className="h-4 w-4 text-cyan-400" />
                      CSV Export
                    </button>
                  </MobileMenuItem>
                )}
                
                {isMultiStreamEnabled && (
                  <MobileMenuItem>
                    <Link 
                      href="/multi-stream" 
                      className="flex w-full items-center gap-2 px-4 py-2.5 bg-[#18181b]/80 text-white rounded-lg border border-[#26262c] hover:border-cyan-500/30 transition-all text-sm font-medium backdrop-blur-sm"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Video className="h-4 w-4 text-cyan-400" />
                      Multi Stream
                    </Link>
                  </MobileMenuItem>
                )}

                <MobileMenuItem>
                  <a 
                    href="https://streamelements.com/alantiix/tip" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="flex w-full items-center gap-2 px-4 py-2.5 bg-[#18181b]/80 text-white rounded-lg border border-[#26262c] hover:border-[#ff4545]/30 transition-all text-sm font-medium backdrop-blur-sm"
                  >
                    <Heart className="h-4 w-4 text-[#ff4545]" />
                    Donate
                  </a>
                </MobileMenuItem>
              </div>
            </div>
          </div>
        </MobileMenu>
        )}
      </motion.header>

      {/* Notification Banners */}
      <AnimatePresence>
        {banners.length > 0 && (
          <motion.div 
            className="relative z-40"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={springs.smooth}
          >
            <div className="max-w-7xl mx-auto px-2 sm:px-4 md:px-6 pt-3">
              <NotificationBannerList 
                banners={banners} 
                onDismiss={dismissBanner}
                maxVisible={2}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content with page transition */}
      <motion.main 
        className={cn(
          "flex-1 overflow-y-auto relative z-10",
          showPWADock && "pwa-dock-content-padding" // Add bottom padding for dock with safe area
        )}
        style={showPWADock ? { paddingBottom: 'calc(72px + env(safe-area-inset-bottom, 0px))' } : undefined}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ 
          duration: 0.5, 
          ease: [0.22, 1, 0.36, 1],
          delay: 0.2
        }}
      >
        <div className="max-w-7xl mx-auto p-3 sm:p-4 md:p-6">
          {children}
        </div>
      </motion.main>

      {/* CSV Export Dialog */}
      {isCsvExportEnabled && (
        <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
          <DialogContent className="bg-[#0e0e10]/95 backdrop-blur-xl border-cyan-500/20 text-white max-w-[90vw] sm:max-w-lg shadow-2xl shadow-cyan-500/10">
            {servers && selectedServers ? (
              <CSVExport servers={servers} selectedServers={selectedServers} />
            ) : (
              <div className="p-4 text-center">
                <p className="mb-4">Please go to the dashboard to export data.</p>
                <Button 
                  onClick={() => setShowExportDialog(false)}
                  className="bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-black font-semibold"
                >
                  Close
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={showResourceDialog} onOpenChange={setShowResourceDialog}>
        <DialogContent className="bg-[#0e0e10]/95 backdrop-blur-xl border-cyan-500/20 text-white max-w-[95vw] sm:max-w-3xl shadow-2xl shadow-cyan-500/10">
          <ServerResourceChanges 
            isOpen={showResourceDialog}
            servers={servers}
            selectedServers={selectedServers}
          />
        </DialogContent>
      </Dialog>

      <SlideoutPanel
        isOpen={showSiteUpdatesPanel}
        onClose={() => setShowSiteUpdatesPanel(false)}
        title="Site Updates"
        description="Recent changes, roadmap, and git commits"
      >
        <SiteUpdatesPanel isOpen={showSiteUpdatesPanel} />
      </SlideoutPanel>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* FOOTER - Made with love attribution                                  */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <motion.footer
        className="relative z-10 py-4 text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.5 }}
      >
        <p className="text-xs text-[#ADADB8]/60 flex items-center justify-center gap-1">
          Made with{' '}
          <motion.span
            className="text-[#ff4545]"
            animate={{ 
              scale: [1, 1.2, 1],
            }}
            transition={{ 
              duration: 1.5, 
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            <Heart className="h-3 w-3 inline fill-current" />
          </motion.span>
          {' '}by alantiix
        </p>
      </motion.footer>

      {/* PWA Bottom Dock - Native app-like navigation for installed PWA */}
      <AnimatePresence>
        {showPWADock && (
          <PWABottomDock
            onSiteUpdatesClick={() => setShowSiteUpdatesPanel(true)}
            onExportClick={() => setShowExportDialog(true)}
          />
        )}
      </AnimatePresence>
    </div>
  );
} 

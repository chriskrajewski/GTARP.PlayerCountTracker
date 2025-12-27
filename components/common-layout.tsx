"use client";

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { ArrowLeft, Download, ClipboardList, MessageSquare, Menu, X, Heart, Bot, Video, History } from 'lucide-react';
import FeedbackForm from '@/components/feedback-form';
import { CSVExport } from '@/components/csv-export';
import ServerResourceChanges from '@/components/server-resource-changes';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { DataStartPopup } from '@/components/data-start-popup';
import { DataRefreshPopup } from '@/components/data-refresh-popup';
import { useFeatureGate, FEATURE_GATES } from '@/lib/statsig';
import Image from 'next/image';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { NotificationBannerList, useNotificationBanners } from '@/components/notification-banner';
import mixpanel from "mixpanel-browser";

// Create an instance of the Mixpanel object, your token is already added to this snippet
      mixpanel.init('13440c630224bb2155944bc8de971af7', {
      autocapture: true,
      record_sessions_percent: 100,
    })

interface CommonLayoutProps {
  children: React.ReactNode;
  showBackButton?: boolean;
  pageTitle?: string;
  // Optional props for CSV export functionality
  servers?: any[];
  selectedServers?: string[];
}

export function CommonLayout({ 
  children, 
  showBackButton = false, 
  pageTitle,
  servers = [],
  selectedServers = []
}: CommonLayoutProps) {
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showResourceDialog, setShowResourceDialog] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Feature gates - Temporarily force to true for debugging
  // const isFeedbackEnabled = useFeatureGate(FEATURE_GATES.FEEDBACK_FORM);
  // const isChangelogEnabled = useFeatureGate(FEATURE_GATES.CHANGELOG);
  // const isCsvExportEnabled = useFeatureGate(FEATURE_GATES.CSV_EXPORT);
  // const isNotificationBannersEnabled = useFeatureGate(FEATURE_GATES.NOTIFICATION_BANNERS);
  
  // FORCE ENABLE for debugging
  const isFeedbackEnabled = true;
  const isChangelogEnabled = true;
  const isCsvExportEnabled = true;
  const isNotificationBannersEnabled = true;
  
  // Notification banners
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
    <div className="flex flex-col min-h-screen">
      {/* Header with controls - Responsive design */}
      <div 
        className="twitch-dark-bg text-white px-2 sm:px-4 flex items-center justify-between sticky top-0 z-10 flex-wrap"
        style={{ 
          backgroundColor: '#0e0e10', 
          borderBottom: '1px solid #26262c',
          minHeight: '56px',
        }}
      >
        <div className="flex items-center gap-2 py-3">
          {showBackButton && (
            <Link href="/" className="text-white hover:text-gray-300 flex items-center justify-center w-5 h-5">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          )}
          <h1 className="font-bold text-sm sm:text-base flex items-center whitespace-nowrap overflow-hidden text-ellipsis">
            <img 
              src="pepeRP.webp" 
              alt="pepeRP Logo" 
              className="h-7 w-7 sm:h-9 sm:w-9 mr-2" 
              style={{ color: '#004D61' }} 
            />
            <span className="mt-0.5 truncate max-w-[160px] sm:max-w-none">{pageTitle || "Discover, Track, and Watch GTA Roleplay"}</span>
          </h1>
        </div>
        
        {/* Data Refresh/Start Components - Hidden on smallest screens */}
        <div className="hidden sm:flex items-center gap-1 text-xs text-[#ADADB8] ml-2 mr-auto order-3 sm:order-2">
          <DataRefreshPopup /> | <DataStartPopup />
        </div>

        {/* Mobile menu button */}
        <div className="flex items-center sm:hidden order-2">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setMobileMenuOpen(!mobileMenuOpen);
            }} 
            className="p-1.5 rounded-md text-white bg-[#18181b] hover:bg-[#26262c]"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Header Buttons - Desktop */}
        <div className="hidden sm:flex items-center gap-2 order-3">
          {isFeedbackEnabled && (
            <FeedbackForm 
              trigger={
                <button className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#18181b] text-white rounded-md hover:bg-[#26262c] transition-colors text-xs font-medium">
                  <MessageSquare className="h-3.5 w-3.5 text-white" />
                  Feedback
                </button>
              }
            />
          )}
          
          {isChangelogEnabled && (
            <Link href="/changelog" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#18181b] text-[#EFEFF1] rounded-md hover:bg-[#26262c] transition-colors text-xs font-medium" style={{ color: '#EFEFF1' }}>
              <ClipboardList className="h-3.5 w-3.5 text-[#EFEFF1]" />
              <span className="text-[#EFEFF1]">Changelog</span>
            </Link>
          )}

          <Link 
            href="/serverchangelog" 
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#18181b] text-[#EFEFF1] rounded-md hover:bg-[#26262c] transition-colors text-xs font-medium"
          >
            <History className="h-3.5 w-3.5 text-[#EFEFF1]" />
            <span className="text-[#EFEFF1]">Server Changes</span>
          </Link>
          
          {isCsvExportEnabled && (
            <button 
              onClick={() => setShowExportDialog(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#18181b] text-[#EFEFF1] rounded-md hover:bg-[#26262c] transition-colors text-xs font-medium"
            >
              <Download className="h-3.5 w-3.5" />
              CSV Export
            </button>
          )}
          
          <Link 
            href="/multi-stream" 
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#18181b] text-[#EFEFF1] rounded-md hover:bg-[#26262c] transition-colors text-xs font-medium"
          >
            <Video className="h-3.5 w-3.5 text-white" /> 
            <span className="text-[#EFEFF1]">Multi Stream</span>
          </Link>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <a 
                  href="https://streamelements.com/alantiix/tip" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#18181b] text-[#EFEFF1] rounded-md hover:bg-[#26262c] transition-colors text-xs font-medium"
                >
                  <Heart className="h-3.5 w-3.5 text-[#ff4545]" />
                  <span className="text-[#EFEFF1]">Donate</span>
                </a>
              </TooltipTrigger>
              <TooltipContent className="bg-[#18181b] text-white border-[#26262c]">
                Buy me a cup of coffee :)
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        
        {/* Mobile menu - Expanded */}
        {mobileMenuOpen && (
          <div 
            className="w-full py-2 sm:hidden order-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col gap-2">
              {/* Mobile Data info */}
              <div className="flex items-center gap-1 text-xs text-[#ADADB8] px-2 py-1">
                <DataRefreshPopup /> | <DataStartPopup />
              </div>
              
              <div className="h-px bg-[#26262c] my-1"></div>
              
              {/* Mobile action buttons */}
              <div className="flex flex-col gap-2 px-2">
                {isFeedbackEnabled && (
                  <Link 
                    href="/feedback" 
                    className="flex w-full items-center gap-1.5 px-3 py-2 bg-[#18181b] text-white rounded-md hover:bg-[#26262c] transition-colors text-xs font-medium"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <MessageSquare className="h-3.5 w-3.5 text-white" />
                    Feedback
                  </Link>
                )}
                
                {isChangelogEnabled && (
                  <Link 
                    href="/changelog" 
                    className="flex w-full items-center gap-1.5 px-3 py-2 bg-[#18181b] text-[#EFEFF1] rounded-md hover:bg-[#26262c] transition-colors text-xs font-medium"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <ClipboardList className="h-3.5 w-3.5 text-[#EFEFF1]" />
                    <span className="text-[#EFEFF1]">Changelog</span>
                  </Link>
                )}

                <Link 
                  href="/serverchangelog" 
                  className="flex w-full items-center gap-1.5 px-3 py-2 bg-[#18181b] text-[#EFEFF1] rounded-md hover:bg-[#26262c] transition-colors text-xs font-medium"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <History className="h-3.5 w-3.5 text-[#EFEFF1]" />
                  <span className="text-[#EFEFF1]">Server Changes</span>
                </Link>
                
               {isCsvExportEnabled && (
                  <button 
                    onClick={() => {
                      setShowExportDialog(true);
                      setMobileMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-1.5 px-3 py-2 bg-[#18181b] text-[#EFEFF1] rounded-md hover:bg-[#26262c] transition-colors text-xs font-medium"
                  >
                    <Download className="h-3.5 w-3.5" />
                    CSV Export
                  </button>
                )}

                <button
                  onClick={() => {
                    setShowResourceDialog(true);
                    setMobileMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-1.5 px-3 py-2 bg-[#18181b] text-[#EFEFF1] rounded-md hover:bg-[#26262c] transition-colors text-xs font-medium"
                >
                  <History className="h-3.5 w-3.5 text-[#EFEFF1]" />
                  Server Changes
                </button>
                
               <Link 
                  href="/multi-stream" 
                  className="flex w-full items-center gap-1.5 px-3 py-2 bg-[#18181b] text-[#EFEFF1] rounded-md hover:bg-[#26262c] transition-colors text-xs font-medium"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Bot className="h-3.5 w-3.5" />
                  <span className="text-[#EFEFF1]">Multi Stream</span>
                </Link> 

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <a 
                        href="https://streamelements.com/alantiix/tip" 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="flex w-full items-center gap-1.5 px-3 py-2 bg-[#18181b] text-white rounded-md hover:bg-[#26262c] transition-colors text-xs font-medium"
                      >
                        <Heart className="h-3.5 w-3.5 text-[#ff4545]" />
                        <span className="text-[#EFEFF1]">Donate</span>
                      </a>
                    </TooltipTrigger>
                    <TooltipContent className="bg-[#18181b] text-white border-[#26262c]">
                      Buy me a cup of coffee :)
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Notification Banners */}
      {isNotificationBannersEnabled && banners.length > 0 && (
        <div className="relative z-40">
          <div className="max-w-7xl mx-auto px-2 sm:px-4 md:px-6 pt-2">
            <NotificationBannerList 
              banners={banners} 
              onDismiss={dismissBanner}
              maxVisible={2}
            />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-2 sm:p-4 md:p-6">
          {children}
        </div>
      </div>

      {/* CSV Export Dialog */}
      {isCsvExportEnabled && (
        <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
          <DialogContent className="bg-[#0e0e10] border-[#26262c] text-white max-w-[90vw] sm:max-w-lg">
            {servers && selectedServers ? (
              <CSVExport servers={servers} selectedServers={selectedServers} />
            ) : (
              <div className="p-4 text-center">
                <p className="mb-4">Please go to the dashboard to export data.</p>
                <Button 
                  onClick={() => setShowExportDialog(false)}
                  className="bg-[#004D61] hover:bg-[#003a4d] text-white"
                >
                  Close
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={showResourceDialog} onOpenChange={setShowResourceDialog}>
        <DialogContent className="bg-[#0e0e10] border-[#26262c] text-white max-w-[95vw] sm:max-w-3xl">
          <ServerResourceChanges 
            isOpen={showResourceDialog}
            servers={servers}
            selectedServers={selectedServers}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
} 

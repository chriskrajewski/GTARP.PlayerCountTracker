"use client";

import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft, Download, ClipboardList, MessageSquare } from 'lucide-react';
import FeedbackForm from '@/components/feedback-form';
import { CSVExport } from '@/components/csv-export';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { DataStartPopup } from '@/components/data-start-popup';
import { DataRefreshPopup } from '@/components/data-refresh-popup';
import Image from 'next/image';

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

  return (
    <div className="flex flex-col min-h-screen bg-black" style={{ backgroundColor: '#000000' }}>
      {/* Header with controls - Fixed height to match multi-stream viewer exactly */}
      <div 
        className="h-14 twitch-dark-bg text-white px-4 flex items-center justify-between sticky top-0 z-10" 
        style={{ 
          backgroundColor: '#0e0e10', 
          borderBottom: '1px solid #26262c',
          minHeight: '56px',
          maxHeight: '56px'
        }}
      >
        <div className="flex flex-1 items-center gap-4">
          {showBackButton && (
            <Link href="/" className="text-white hover:text-gray-300 flex items-center justify-center w-5 h-5">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          )}
          <h1 className="font-bold text-base flex items-center whitespace-nowrap">
            <img 
              src="https://cdn.7tv.app/emote/01JJATQQM8STYV57WK3837PNAQ/2x.webp" 
              alt="Twitch Logo" 
              className="h-9 w-9 mr-2" 
              style={{ color: '#004D61' }} 
            />
            <span className="mt-0.5">{pageTitle || "GTA RP Player Count Tracker"}</span>
          </h1>
          
          {/* Data Refresh/Start Components */}
          <div className="flex items-center gap-1 text-xs text-[#ADADB8] ml-4">
            <DataRefreshPopup /> | <DataStartPopup />
          </div>
        </div>

        {/* Header Buttons */}
        <div className="flex items-center gap-2">
          <FeedbackForm 
            trigger={
              <button className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#18181b] text-[#EFEFF1] rounded-md hover:bg-[#26262c] transition-colors text-xs font-medium">
                <MessageSquare className="h-3.5 w-3.5" />
                Feedback
              </button>
            }
          />
          
          <Link href="/changelog" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#18181b] text-[#EFEFF1] rounded-md hover:bg-[#26262c] transition-colors text-xs font-medium" style={{ color: '#EFEFF1' }}>
            <ClipboardList className="h-3.5 w-3.5 text-[#EFEFF1]" />
            <span className="text-[#EFEFF1]">Changelog</span>
          </Link>
          
          <button 
            onClick={() => setShowExportDialog(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#18181b] text-[#EFEFF1] rounded-md hover:bg-[#26262c] transition-colors text-xs font-medium"
          >
            <Download className="h-3.5 w-3.5" />
            CSV Export
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto" style={{ backgroundColor: '#000000' }}>
        <div className="max-w-7xl mx-auto p-4 md:p-6">
          {children}
        </div>
      </div>

      {/* CSV Export Dialog */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent className="bg-[#0e0e10] border-[#26262c] text-white">
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
    </div>
  );
} 
'use client';

import { useState } from 'react';
import { Check, Copy, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ShareLinkProps {
  /**
   * The relative path of the report (e.g. `/wrapped/2024-01`). The absolute URL
   * is resolved on the client from `window.location.origin` so the copied link
   * always matches the host the visitor is on (R5.4).
   */
  path: string;
}

/**
 * A small client control that surfaces a copyable share URL for an
 * Insights_Report (R5.4). The link is public and renders the same report for
 * any visitor who opens it. Kept deliberately tiny so the rest of the Wrapped
 * page can stay a server component.
 */
export function ShareLink({ path }: ShareLinkProps) {
  const [copied, setCopied] = useState(false);

  // Build a display URL; falls back to the bare path before hydration.
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const shareUrl = `${origin}${path}`;

  const handleCopy = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // Clipboard can be unavailable (permissions/insecure context); the input
      // below stays selectable so the user can copy manually.
    }
  };

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="flex items-center gap-2 text-cyan-300">
        <Share2 className="h-4 w-4" />
        <span className="text-sm font-medium text-white">Share this report</span>
      </div>
      <div className="flex flex-1 items-center gap-2">
        <input
          readOnly
          value={shareUrl || path}
          onFocus={(e) => e.currentTarget.select()}
          aria-label="Shareable report link"
          className="flex-1 truncate rounded-lg border border-[#26262c] bg-[#18181b]/80 px-3 py-2 text-sm text-[#ADADB8] focus:border-cyan-500/50 focus:outline-none"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleCopy}
          className="shrink-0 gap-1.5"
        >
          {copied ? (
            <>
              <Check className="h-4 w-4 text-emerald-400" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" />
              Copy link
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

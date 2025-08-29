"use client";

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { pageview, GA_TRACKING_ID } from '@/lib/gtag';

export default function GoogleAnalytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!GA_TRACKING_ID) {
      return;
    }

    const url = pathname + (searchParams.toString() ? `?${searchParams.toString()}` : '');
    
    // Track page view
    pageview(url);
    
    // Debug logging in development
    if (process.env.NODE_ENV === 'development') {
      console.log('Google Analytics page view tracked:', {
        url,
        pathname,
        searchParams: searchParams.toString(),
        trackingId: GA_TRACKING_ID
      });
    }
  }, [pathname, searchParams]);

  return null;
}
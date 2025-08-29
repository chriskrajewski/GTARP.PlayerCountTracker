// Google Analytics utilities
export const GA_TRACKING_ID = process.env.NEXT_PUBLIC_GA_TRACKING_ID || 'G-RSDCL05D2D';

// https://developers.google.com/analytics/devguides/collection/gtagjs/pages
export const pageview = (url: string) => {
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('config', GA_TRACKING_ID, {
      page_path: url,
    });
  }
};

// https://developers.google.com/analytics/devguides/collection/gtagjs/events
export const event = ({ action, category, label, value }: {
  action: string;
  category: string;
  label?: string;
  value?: number;
}) => {
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', action, {
      event_category: category,
      event_label: label,
      value: value,
    });
  }
};

// Track custom events for your app
export const trackServerSelect = (serverId: string, serverName: string) => {
  event({
    action: 'server_select',
    category: 'engagement',
    label: `${serverId}-${serverName}`,
  });
};

export const trackTimeRangeSelect = (timeRange: string) => {
  event({
    action: 'time_range_select',
    category: 'engagement', 
    label: timeRange,
  });
};

export const trackStreamClick = (streamerName: string, serverId: string) => {
  event({
    action: 'stream_click',
    category: 'engagement',
    label: `${streamerName}-${serverId}`,
  });
};

export const trackAdminAccess = (page: string) => {
  event({
    action: 'admin_access',
    category: 'admin',
    label: page,
  });
};
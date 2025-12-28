"use client";

import type { CSSProperties } from 'react';

interface IconProps {
  className?: string;
  style?: CSSProperties;
}

/**
 * Kick platform icon (no official lucide icon exists)
 */
export function KickIcon({ className, style }: IconProps) {
  return (
    <svg 
      viewBox="0 0 24 24" 
      fill="currentColor" 
      className={className}
      style={style}
    >
      <path d="M1.333 0v24h21.334V0H1.333zm17.12 18.347h-4.32l-3.093-4.907-1.653 1.76v3.147H5.654V5.653h3.733v5.28l4.48-5.28h4.427l-4.907 5.44 4.986 7.254h.08z"/>
    </svg>
  );
}

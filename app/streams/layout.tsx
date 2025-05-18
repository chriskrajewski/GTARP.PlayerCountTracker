import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Streams - GTA RP Player Count Tracker',
  description: 'View active Twitch streams for GTA RP servers',
}

export default function StreamsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
} 
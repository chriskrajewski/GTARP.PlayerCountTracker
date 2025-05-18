import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Changelog - GTA RP Player Count Tracker',
  description: 'View recent updates and changes to the GTA RP Player Count Tracker',
}

export default function ChangelogLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
} 
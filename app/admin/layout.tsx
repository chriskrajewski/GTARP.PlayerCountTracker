import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Admin Dashboard - GTA RP Player Count Tracker',
  description: 'Administrative dashboard for managing GTA RP Player Count Tracker',
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}

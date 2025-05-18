import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Feedback - GTA RP Player Count Tracker',
  description: 'Submit feedback, bug reports, or feature requests for the GTA RP Player Count Tracker',
}

export default function FeedbackLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
} 
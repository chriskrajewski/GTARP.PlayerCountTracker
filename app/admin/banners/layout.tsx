import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Admin - Notification Banners | FiveM Player Count Tracker',
  description: 'Manage notification banners for the GTA RP Player Count Tracker site',
};

export default function AdminBannersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

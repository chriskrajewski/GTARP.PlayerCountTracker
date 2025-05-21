import { CommonLayout } from '@/components/common-layout';

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CommonLayout pageTitle="GTA RP Stats Assistant" showBackButton={true}>
      {children}
    </CommonLayout>
  );
} 
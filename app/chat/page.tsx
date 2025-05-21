import GrokChat from '@/components/GrokChat';

export const metadata = {
  title: 'GTA RP Stats Assistant',
  description: 'Ask questions about FiveM GTA RP player counts, viewer counts, and streamer statistics',
};

export default function ChatPage() {
  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-6 text-center">GTA RP Stats Assistant</h1>
      <p className="text-center mb-8 text-muted-foreground">
        Ask questions about player counts, viewer counts, and streamer statistics
      </p>
      <GrokChat />
    </div>
  );
} 
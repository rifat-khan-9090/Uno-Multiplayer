import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'UNO Multiplayer Engine',
  description: 'Full-stack web-based UNO multiplayer card game application with AI Bots and Core Game Logic Engine.',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}

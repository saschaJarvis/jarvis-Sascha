import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Jarvis',
  description: 'Dein ruhiger Assistent für Fristen, Rechnungen, Verträge und den Umzug nach Dubai.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Jarvis', statusBarStyle: 'black-translucent' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#03080e' },
    { media: '(prefers-color-scheme: dark)', color: '#03080e' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}

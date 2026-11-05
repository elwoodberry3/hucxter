import type { Metadata, Viewport } from 'next';
import { connection } from 'next/server';
import type { ReactNode } from 'react';
import { serverConfig } from '@/lib/env';
import './globals.css';

export function generateMetadata(): Metadata {
  return {
    metadataBase: serverConfig().appOrigin,
    title: { default: 'Hucxter', template: '%s · Hucxter' },
    description: 'Buy and sell locally with short videos.',
    icons: {
      icon: [
        { url: '/favicon.ico', sizes: '16x16 32x32 48x48' },
        { url: '/favicon-16.png', type: 'image/png', sizes: '16x16' },
        { url: '/favicon-32.png', type: 'image/png', sizes: '32x32' },
        { url: '/favicon-48.png', type: 'image/png', sizes: '48x48' },
      ],
      apple: { url: '/apple-touch-icon.png', sizes: '180x180' },
    },
  };
}

// Mobile first (ADR-0011): fit the device, cover the notch area (safe-area insets are handled in
// CSS), and never disable pinch zoom.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  colorScheme: 'light dark',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Render per request so Next.js can stamp the CSP nonce from src/proxy.ts onto its scripts.
  await connection();
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Hucxter',
    short_name: 'Hucxter',
    description: 'Buy and sell locally with short videos.',
    start_url: '/',
    display: 'standalone',
    background_color: '#545072',
    theme_color: '#545072',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}

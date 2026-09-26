import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Agenda à deux',
        short_name: 'À deux',
        description: 'Agenda et listes partagés à deux',
        lang: 'fr',
        start_url: '/',
        display: 'standalone',
        background_color: '#FFF8EF',
        theme_color: '#3451E6',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', },
        ],
      },
      workbox: { navigateFallbackDenylist: [/^\/__\//] },
    }),
  ],
});

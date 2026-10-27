import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import pkg from './package.json';

// Version affichée dans l'app : numéro du package + date et heure de la compilation.
const now = new Date();
const two = (n: number) => String(n).padStart(2, '0');
const stamp = `${two(now.getDate())}.${two(now.getMonth() + 1)} ${two(now.getHours())}:${two(now.getMinutes())}`;

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(`v${pkg.version} · ${stamp}`) },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['icon.svg', 'badge.png', 'push-sw.js'],
      manifest: {
        name: 'Agenda à deux',
        short_name: 'À deux',
        description: 'Agenda et listes partagés à deux',
        lang: 'fr',
        start_url: '/',
        display: 'standalone',
        background_color: '#FFF6FA',
        theme_color: '#FF8A5B',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', },
        ],
      },
      workbox: { navigateFallbackDenylist: [/^\/__\//], importScripts: ['push-sw.js'],
        // Nouvelle version : elle prend la main tout de suite, sans attendre une 2e ouverture.
        clientsClaim: true, skipWaiting: true, cleanupOutdatedCaches: true },
    }),
  ],
});

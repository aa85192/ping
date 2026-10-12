import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const projectId = env.VITE_FIREBASE_PROJECT_ID;
  return {
    server: projectId
      ? {
          // `npx firebase-tools emulators:start --only functions` serves the API here.
          proxy: { '/api': { target: `http://127.0.0.1:5001/${projectId}/asia-east1/api`, changeOrigin: true } },
        }
      : undefined,
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.png', 'apple-touch-icon.png'],
        manifest: {
          name: 'Ping 旅行手帳',
          short_name: 'Ping',
          description: '兩人共編的旅行行程、景點卡片與交通時間',
          lang: 'zh-TW',
          theme_color: '#FFF9EC',
          background_color: '#FFF9EC',
          display: 'standalone',
          start_url: '/',
          icons: [
            { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
          // Android: share a place from the Google Maps app straight into Ping's inbox.
          share_target: {
            action: '/share',
            method: 'GET',
            params: { title: 'title', text: 'text', url: 'url' },
          },
        },
        workbox: {
          navigateFallback: '/index.html',
          globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
          runtimeCaching: [
            {
              urlPattern: ({ url }) => url.hostname === 'api.open-meteo.com' || url.hostname === 'archive-api.open-meteo.com',
              handler: 'NetworkFirst',
              options: { cacheName: 'weather', expiration: { maxEntries: 50, maxAgeSeconds: 7 * 86400 } },
            },
            {
              urlPattern: ({ url }) => url.hostname.endsWith('googleusercontent.com'),
              handler: 'CacheFirst',
              options: { cacheName: 'place-photos', expiration: { maxEntries: 300, maxAgeSeconds: 30 * 86400 } },
            },
            {
              urlPattern: ({ url }) => url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com',
              handler: 'CacheFirst',
              options: { cacheName: 'fonts', expiration: { maxEntries: 30, maxAgeSeconds: 365 * 86400 } },
            },
          ],
        },
      }),
    ],
  };
});

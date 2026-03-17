import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png'],
      manifest: {
        name: '감사 코인',
        short_name: '감사코인',
        description: '동료에게 감사한 마음을 코인으로 전달하세요',
        theme_color: '#f59e0b',
        background_color: '#1a0a00',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        lang: 'ko',
        icons: [
          { src: '/icons/icon-72x72.png',            sizes: '72x72',   type: 'image/png' },
          { src: '/icons/icon-96x96.png',            sizes: '96x96',   type: 'image/png' },
          { src: '/icons/icon-128x128.png',          sizes: '128x128', type: 'image/png' },
          { src: '/icons/icon-144x144.png',          sizes: '144x144', type: 'image/png' },
          { src: '/icons/icon-152x152.png',          sizes: '152x152', type: 'image/png' },
          { src: '/icons/icon-192x192.png',          sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-384x384.png',          sizes: '384x384', type: 'image/png' },
          { src: '/icons/icon-512x512.png',          sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts-cache', expiration: { maxEntries: 10, maxAgeSeconds: 31536000 } },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'gstatic-fonts-cache', expiration: { maxEntries: 10, maxAgeSeconds: 31536000 } },
          },
        ],
      },
    }),
  ],
})

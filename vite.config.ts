import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA, type ManifestOptions } from 'vite-plugin-pwa'

// share_target is a valid manifest member but missing from the plugin's types.
const manifest: Partial<ManifestOptions> & Record<string, unknown> = {
  name: 'SmplTrack',
  short_name: 'SmplTrack',
  description: 'Workout insights from your notes app',
  theme_color: '#0a0a0a',
  background_color: '#0a0a0a',
  display: 'standalone',
  start_url: '/',
  icons: [
    { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
  // GET share target: Android puts the shared note text in ?text=..., read by the /share route.
  share_target: {
    action: '/share',
    method: 'GET',
    params: { title: 'title', text: 'text', url: 'url' },
  },
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest,
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: 'index.html',
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})

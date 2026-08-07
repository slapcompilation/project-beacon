import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

// Bake the commit SHA into index.html so scripts/verify-deploy.mjs can prove
// which commit production actually serves ("merged" ≠ "deployed" bit us twice).
const buildSha = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? 'dev'
const buildShaMeta: Plugin = {
  name: 'build-sha-meta',
  transformIndexHtml: () => [
    { tag: 'meta', attrs: { name: 'beacon-build', content: buildSha }, injectTo: 'head' },
  ],
}

export default defineConfig({
  plugins: [
    react(),
    buildShaMeta,
    VitePWA({
      // autoUpdate so a new deploy activates on next load instead of stranding
      // users on a stale precached bundle (the cause of "fixes never reach me").
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'Beacon — Hotel Inventory',
        short_name: 'Beacon',
        description: 'Hotel inventory management — track stock, restocks, and waste.',
        theme_color: '#0f172a', // slate-900 matches sidebar
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Cache-first for compiled assets (they have content-hash filenames)
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Activate a new SW immediately + drop old precaches, so a deploy takes
        // effect on the next load rather than waiting for every tab to close.
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        // Don't let the index.html navigation fallback shadow real static files
        // (a browser navigation to /robots.txt would otherwise return the SPA).
        navigateFallbackDenylist: [/^\/robots\.txt$/, /^\/sitemap\.xml$/],
        // Network-first for Supabase API and auth — we never want stale data
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api',
              networkTimeoutSeconds: 5,
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // Warn if any single chunk exceeds 500kb gzipped
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        // Route-based code splitting — each route is its own chunk
        manualChunks: {
          'react-vendor':     ['react', 'react-dom', 'react-router-dom'],
          'query-vendor':     ['@tanstack/react-query'],
          'blueprint-vendor': ['@blueprintjs/core', '@blueprintjs/icons'],
        },
      },
    },
  },
})

import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react-swc'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  test: {
    environment: 'jsdom',
    css: false,
    // e2e/ is Playwright's (real browser); keep it out of the unit runner
    exclude: ['**/node_modules/**', 'e2e/**'],
  },
})

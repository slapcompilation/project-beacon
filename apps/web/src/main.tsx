import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { registerSW } from 'virtual:pwa-register'
import { queryClient } from '@/lib/queryClient'
import { App } from '@/App'
import '@/styles/globals.css'

// Register service worker — updateSW is unused in prompt mode;
// vite-pwa handles the reload prompt via the ReloadPrompt component if needed.
registerSW({ immediate: false })

const root = document.getElementById('root')
if (!root) throw new Error('Root element not found')

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  </StrictMode>
)

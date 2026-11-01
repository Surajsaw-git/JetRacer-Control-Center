import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import App from './App'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

// Initialize dark theme by default if not set
try {
  const urlTheme = new URLSearchParams(window.location.search).get('theme')
  if (urlTheme === 'light') {
    document.documentElement.classList.remove('dark')
    document.documentElement.classList.add('light')
  } else if (urlTheme === 'dark') {
    document.documentElement.classList.remove('light')
    document.documentElement.classList.add('dark')
  } else {
    const stored = localStorage.getItem('jetracer_settings')
    if (stored) {
      const parsed = JSON.parse(stored)
      const theme = parsed?.state?.appearance?.theme
      if (theme === 'light') {
        document.documentElement.classList.remove('dark')
        document.documentElement.classList.add('light')
      } else {
        document.documentElement.classList.add('dark')
      }
    } else {
      document.documentElement.classList.add('dark')
    }
  }
} catch {
  document.documentElement.classList.add('dark')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={200}>
        <App />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  </StrictMode>,
)

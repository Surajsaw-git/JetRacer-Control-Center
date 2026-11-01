import { useEffect } from 'react'
import { Moon, Sun, Laptop } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useSettingsStore } from '@/store/settingsStore'
import type { AppTheme } from '@/types'

export function ThemeToggle() {
  const theme = useSettingsStore((state) => state.appearance.theme)
  const updateAppearance = useSettingsStore((state) => state.updateAppearance)

  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('light', 'dark')

    if (theme === 'system') {
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      root.classList.add(systemDark ? 'dark' : 'light')
    } else {
      root.classList.add(theme)
    }
  }, [theme])

  const setTheme = (newTheme: AppTheme) => {
    updateAppearance({ theme: newTheme })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full min-h-[44px] min-w-[44px] sm:min-h-[36px] sm:min-w-[36px]"
          aria-label={`Toggle theme (currently ${theme})`}
        >
          {theme === 'light' ? (
            <Sun className="h-4 w-4" />
          ) : theme === 'dark' ? (
            <Moon className="h-4 w-4" />
          ) : (
            <Laptop className="h-4 w-4" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => setTheme('light')}
          className="min-h-[44px] sm:min-h-[36px]"
        >
          <Sun className="h-4 w-4 mr-2" />
          <span>Light</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('dark')} className="min-h-[44px] sm:min-h-[36px]">
          <Moon className="h-4 w-4 mr-2" />
          <span>Dark (Default)</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme('system')}
          className="min-h-[44px] sm:min-h-[36px]"
        >
          <Laptop className="h-4 w-4 mr-2" />
          <span>System</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default ThemeToggle

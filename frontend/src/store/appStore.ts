import { create } from 'zustand'

export type AppTheme = 'light' | 'dark' | 'system'

export interface AppState {
  appVersion: string
  theme: AppTheme
  setTheme: (theme: AppTheme) => void
}

export const useAppStore = create<AppState>((set) => ({
  appVersion: '0.1.0',
  theme: 'system',
  setTheme: (theme) => set({ theme }),
}))

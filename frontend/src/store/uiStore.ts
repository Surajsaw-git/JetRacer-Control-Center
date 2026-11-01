import { create } from 'zustand'

export interface UiStoreState {
  isSidebarCollapsed: boolean
  isMoreSheetOpen: boolean
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  setMoreSheetOpen: (open: boolean) => void
}

export const useUiStore = create<UiStoreState>((set) => ({
  isSidebarCollapsed: false,
  isMoreSheetOpen: false,
  toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
  setSidebarCollapsed: (collapsed) => set({ isSidebarCollapsed: collapsed }),
  setMoreSheetOpen: (open) => set({ isMoreSheetOpen: open }),
}))

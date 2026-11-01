import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Gamepad2,
  Camera,
  Radar,
  Map,
  Compass,
  Cpu,
  Settings,
  History,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
} from 'lucide-react'
import { ConnectionChip } from '@/components/common/ConnectionChip'
import { RosHeaderIndicator } from '@/components/common/RosHeaderIndicator'
import { EmergencyStopButton } from '@/components/common/EmergencyStopButton'
import { ThemeToggle } from '@/components/common/ThemeToggle'
import { SimulationBanner } from '@/components/common/SimulationBanner'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useUiStore } from '@/store/uiStore'
import { cn } from '@/lib/utils'

// Primary navigation destinations
const allNavItems = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard },
  { label: 'Control', path: '/control', icon: Gamepad2 },
  { label: 'Camera', path: '/camera', icon: Camera },
  { label: 'LiDAR', path: '/lidar', icon: Radar },
  { label: 'Mapping', path: '/mapping', icon: Map },
  { label: 'Navigation', path: '/navigation', icon: Compass },
  { label: 'System', path: '/system', icon: Cpu },
  { label: 'Settings', path: '/settings', icon: Settings },
  { label: 'History', path: '/history', icon: History },
]

// Mobile bottom bar top 4 items + "More"
const mobilePrimaryItems = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard },
  { label: 'Control', path: '/control', icon: Gamepad2 },
  { label: 'Camera', path: '/camera', icon: Camera },
  { label: 'Nav', path: '/navigation', icon: Compass },
]

export function RootLayout() {
  const location = useLocation()
  const { isSidebarCollapsed, toggleSidebar, isMoreSheetOpen, setMoreSheetOpen } = useUiStore()

  // Find active item label for top header
  const currentNav = allNavItems.find(
    (item) =>
      item.path === location.pathname ||
      (item.path !== '/' && location.pathname.startsWith(item.path)),
  )
  const currentTitle = currentNav?.label || 'JetRacer Console'

  return (
    <div className="flex flex-col min-h-[100dvh] bg-background text-foreground select-none">
      {/* 1. Simulation Banner (if simulation mode enabled) */}
      <SimulationBanner />

      <div className="flex-1 flex flex-row min-w-0">
        {/* 2. Desktop / Tablet Collapsible Sidebar (>= 768px) */}
        <aside
          className={cn(
            'hidden md:flex flex-col border-r border-border bg-card transition-all duration-200 z-30 select-none flex-shrink-0',
            isSidebarCollapsed ? 'w-16' : 'w-60',
          )}
        >
          {/* Sidebar Brand Header */}
          <div className="flex items-center justify-between h-14 px-3 border-b border-border">
            {!isSidebarCollapsed && (
              <div className="flex items-center gap-2 overflow-hidden">
                <Gamepad2 className="h-6 w-6 text-primary flex-shrink-0" />
                <span className="font-bold text-base tracking-tight truncate">
                  JetRacer Console
                </span>
              </div>
            )}
            {isSidebarCollapsed && <Gamepad2 className="h-6 w-6 text-primary mx-auto" />}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className="h-8 w-8 ml-auto text-muted-foreground hover:text-foreground hidden lg:flex"
              aria-label={isSidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            >
              {isSidebarCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Sidebar Nav Links */}
          <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
            {allNavItems.map((item) => {
              const Icon = item.icon
              const isActive =
                item.path === '/'
                  ? location.pathname === '/'
                  : location.pathname.startsWith(item.path)

              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/'}
                  title={isSidebarCollapsed ? item.label : undefined}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors min-h-[44px]',
                    isActive
                      ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    isSidebarCollapsed && 'justify-center px-0',
                  )}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  {!isSidebarCollapsed && <span className="truncate">{item.label}</span>}
                </NavLink>
              )
            })}
          </nav>

          {/* Sidebar Footer */}
          {!isSidebarCollapsed && (
            <div className="p-3 border-t border-border text-[11px] text-muted-foreground flex justify-between items-center">
              <span>JetRacer v0.2.0</span>
              <span className="font-mono">Phase 1 UI</span>
            </div>
          )}
        </aside>

        {/* 3. Main Content Wrapper */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Sticky Header */}
          <header className="sticky top-0 z-40 flex items-center justify-between h-14 px-3 sm:px-6 border-b border-border bg-card/80 backdrop-blur select-none">
            {/* Title / Current Page Name */}
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground truncate">
                {currentTitle}
              </h2>
            </div>

            {/* Persistent Controls: Connection Chip, ROS Indicator, Theme Toggle, Emergency Stop */}
            <div className="flex items-center gap-2 sm:gap-3">
              <RosHeaderIndicator />
              <ConnectionChip />
              <ThemeToggle />
              <EmergencyStopButton />
            </div>
          </header>

          {/* Main Scrollable Viewport (wrapped in ErrorBoundary) */}
          <main className="flex-1 overflow-x-hidden overflow-y-auto pb-20 md:pb-6">
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
          </main>
        </div>
      </div>

      {/* 4. Mobile Bottom Tab Bar (< 768px) */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 border-t border-border bg-card/95 backdrop-blur z-50 flex items-center justify-around h-16 px-1 pb-[env(safe-area-inset-bottom,0px)]"
        aria-label="Mobile Navigation Bar"
      >
        {mobilePrimaryItems.map((item) => {
          const Icon = item.icon
          const isActive =
            item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path)

          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={cn(
                'flex flex-col items-center justify-center min-h-[44px] min-w-[48px] px-2 py-1 rounded text-[11px] font-medium transition-colors',
                isActive ? 'text-primary font-bold' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="h-5 w-5 mb-0.5" />
              <span>{item.label}</span>
            </NavLink>
          )
        })}

        {/* "More" Sheet Trigger */}
        <button
          type="button"
          onClick={() => setMoreSheetOpen(true)}
          className={cn(
            'flex flex-col items-center justify-center min-h-[44px] min-w-[48px] px-2 py-1 rounded text-[11px] font-medium transition-colors text-muted-foreground hover:text-foreground',
            isMoreSheetOpen && 'text-primary font-bold',
          )}
          aria-label="Open More Destinations Sheet"
        >
          <MoreHorizontal className="h-5 w-5 mb-0.5" />
          <span>More</span>
        </button>
      </nav>

      {/* 5. Mobile "More" Sheet Drawer */}
      <Sheet open={isMoreSheetOpen} onOpenChange={setMoreSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl px-4 pb-8 pt-4">
          <SheetHeader className="pb-3 border-b border-border">
            <SheetTitle className="text-left text-base">Additional Destinations</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-2 gap-2.5 pt-4">
            {allNavItems.slice(3).map((item) => {
              const Icon = item.icon
              const isActive = location.pathname.startsWith(item.path)

              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setMoreSheetOpen(false)}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-lg border border-border bg-card text-sm font-medium transition-colors min-h-[48px]',
                    isActive
                      ? 'border-primary bg-primary/10 text-primary font-semibold'
                      : 'hover:bg-muted text-foreground',
                  )}
                >
                  <Icon className="h-5 w-5 text-primary" />
                  <span>{item.label}</span>
                </NavLink>
              )
            })}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

export default RootLayout

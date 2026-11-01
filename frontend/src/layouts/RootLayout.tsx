import { NavLink, Outlet } from 'react-router-dom'
import { LayoutDashboard, Camera, Radar, Map, Compass, Gamepad2, Cpu, Settings } from 'lucide-react'

const navItems = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard },
  { label: 'Control', path: '/control', icon: Gamepad2 },
  { label: 'Camera', path: '/camera', icon: Camera },
  { label: 'LiDAR', path: '/lidar', icon: Radar },
  { label: 'Mapping', path: '/mapping', icon: Map },
  { label: 'Navigation', path: '/navigation', icon: Compass },
  { label: 'System', path: '/system', icon: Cpu },
  { label: 'Settings', path: '/settings', icon: Settings },
]

export function RootLayout() {
  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-background text-foreground">
      {/* Desktop Sidebar Navigation */}
      <aside className="hidden md:flex flex-col w-64 border-r border-border bg-card p-4 space-y-4">
        <div className="flex items-center gap-2 px-2 py-3 border-b border-border">
          <Gamepad2 className="h-6 w-6 text-primary" />
          <h1 className="font-bold text-lg leading-tight">JetRacer Control</h1>
        </div>
        <nav className="flex-1 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors min-h-[44px] ${
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  }`
                }
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </NavLink>
            )
          })}
        </nav>
        <div className="text-xs text-muted-foreground px-2 py-2 border-t border-border">
          Phase 0 Foundation
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0">
        <header className="sticky top-0 z-10 flex items-center justify-between h-14 px-4 border-b border-border bg-card/80 backdrop-blur md:px-6">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm md:text-base">JetRacer Control Center</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>v0.1.0 (Phase 0)</span>
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (min 44px touch targets) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t border-border bg-card z-50 flex items-center justify-around h-16 px-1 safe-area-pb">
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center min-h-[44px] min-w-[44px] px-1 py-1 rounded text-[10px] font-medium transition-colors ${
                  isActive
                    ? 'text-primary font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                }`
              }
            >
              <Icon className="h-5 w-5" />
              <span className="truncate max-w-[44px]">{item.label}</span>
            </NavLink>
          )
        })}
      </nav>
    </div>
  )
}

export default RootLayout

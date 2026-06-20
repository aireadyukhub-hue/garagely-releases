import { useState } from 'react'
import { useLocation, Link } from 'react-router-dom'
import {
  LayoutDashboard, Users, Car, Wrench, FileText, FileCheck,
  Calendar, Package, BarChart3, Settings, ChevronLeft, ChevronRight,
  Quote, LogOut
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { signOut } from '@/lib/auth'

const NAV_ITEMS = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/customers', label: 'Customers', icon: Users },
  { path: '/vehicles', label: 'Vehicles', icon: Car },
  { path: '/jobs', label: 'Jobs', icon: Wrench },
  { path: '/invoices', label: 'Invoices', icon: FileText },
  { path: '/quotes', label: 'Quotes', icon: Quote },
  { path: '/calendar', label: 'Calendar', icon: Calendar },
  { path: '/parts', label: 'Parts', icon: Package },
  { path: '/reports', label: 'Reports', icon: BarChart3 },
  { path: '/settings', label: 'Settings', icon: Settings },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/')

  return (
    <div className="flex h-screen bg-[#16181D] overflow-hidden">
      {/* Sidebar */}
      <aside
        className={cn(
          'flex flex-col bg-zinc-950/80 border-r border-zinc-800/60 transition-all duration-200 shrink-0',
          collapsed ? 'w-[60px]' : 'w-[220px]'
        )}
      >
        {/* Logo area - titlebar drag region */}
        <div className={cn(
          'titlebar-drag flex items-center h-14 px-3 border-b border-zinc-800/60 shrink-0',
          collapsed ? 'justify-center' : 'gap-3'
        )}>
          <div className="titlebar-no-drag shrink-0">
            <img
              src="./assets/garagely-mark.svg"
              alt="Garagely"
              className="w-7 h-7"
              onError={(e) => {
                // Fallback for dev mode
                (e.target as HTMLImageElement).src = '/assets/garagely-mark.svg'
              }}
            />
          </div>
          {!collapsed && (
            <img
              src="./assets/garagely-logo-dark.svg"
              alt="Garagely"
              className="h-5 titlebar-no-drag"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/assets/garagely-logo-dark.svg'
              }}
            />
          )}
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map(({ path, label, icon: Icon }) => (
            <Link
              key={path}
              to={path}
              title={collapsed ? label : undefined}
              className={cn(
                isActive(path) ? 'sidebar-item-active' : 'sidebar-item-inactive',
                collapsed ? 'justify-center' : ''
              )}
            >
              <Icon className="w-[18px] h-[18px] shrink-0" />
              {!collapsed && <span>{label}</span>}
            </Link>
          ))}
        </nav>

        {/* Sign out + collapse toggle */}
        <div className="px-2 pb-3 space-y-0.5">
          <button
            onClick={() => signOut()}
            title={collapsed ? 'Sign out' : undefined}
            className={cn(
              'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors text-sm',
              collapsed ? 'justify-center' : ''
            )}
          >
            <LogOut className="w-4 h-4" />
            {!collapsed && <span>Sign out</span>}
          </button>
          <button
            onClick={() => setCollapsed(c => !c)}
            className={cn(
              'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors text-sm',
              collapsed ? 'justify-center' : ''
            )}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : (
              <>
                <ChevronLeft className="w-4 h-4" />
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Titlebar spacer for macOS traffic lights */}
        <div className="titlebar-drag h-8 bg-[#16181D] shrink-0" />

        {/* Page content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-[1400px] mx-auto px-6 pb-8">
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}

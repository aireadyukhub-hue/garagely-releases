import { useState, useEffect } from 'react'
import { useLocation, Link } from 'react-router-dom'
import api from '@/lib/api'
import {
  LayoutDashboard, Users, Car, Wrench, FileText, FileCheck,
  Calendar, Package, BarChart3, Settings, ChevronLeft, ChevronRight,
  Quote, LogOut, Truck, LifeBuoy, HardHat
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { signOut } from '@/lib/auth'
import AssistantWidget from '@/components/AssistantWidget'

const NAV_ITEMS = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/calendar', label: 'Calendar', icon: Calendar },
  { path: '/team', label: 'Team', icon: HardHat },
  { path: '/customers', label: 'Customers', icon: Users },
  { path: '/vehicles', label: 'Vehicles', icon: Car },
  // Workflow order: quote → job sheet → invoice
  { path: '/quotes', label: 'Quotes', icon: Quote },
  { path: '/jobs', label: 'Job Sheets', icon: Wrench },
  { path: '/invoices', label: 'Invoices', icon: FileText },
  { path: '/parts', label: 'Parts', icon: Package },
  { path: '/suppliers', label: 'Suppliers', icon: Truck },
  { path: '/reports', label: 'Reports', icon: BarChart3 },
  { path: '/settings', label: 'Settings', icon: Settings },
  { path: '/help', label: 'Help & Feedback', icon: LifeBuoy },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [logo, setLogo] = useState<string | null>(null)
  const location = useLocation()

  // Customer's custom logo for the top-centre header (refreshes when saved).
  useEffect(() => {
    const loadLogo = () =>
      api.getSettings()
        .then((s) => setLogo((s as { logo_data?: string | null })?.logo_data ?? null))
        .catch(() => {})
    loadLogo()
    window.addEventListener('settings-updated', loadLogo)
    return () => window.removeEventListener('settings-updated', loadLogo)
  }, [])

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
        {/* Logo area - titlebar drag region. GarageLY branding kept here in the
            corner; the customer's own logo (if set) shows top-centre via Layout.
            pt-5 pushes the logo below the macOS traffic-light buttons. */}
        <div className={cn(
          'titlebar-drag flex items-center h-[84px] pt-5 border-b border-zinc-800/60 shrink-0',
          collapsed ? 'justify-center px-2' : 'px-4'
        )}>
          {collapsed ? (
            <img
              src="./assets/garagely-mark.svg"
              alt="GarageLY"
              className="w-11 h-11 titlebar-no-drag"
              onError={(e) => { (e.target as HTMLImageElement).src = '/assets/garagely-mark.svg' }}
            />
          ) : (
            <img
              src="./assets/garagely-logo-dark.svg"
              alt="GarageLY"
              className="h-11 titlebar-no-drag"
              onError={(e) => { (e.target as HTMLImageElement).src = '/assets/garagely-logo-dark.svg' }}
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
        {/* Top bar — customer's logo centred (GarageLY branding stays in the sidebar) */}
        <div className="titlebar-drag h-[84px] pt-5 bg-[#0f1117] border-b border-zinc-800/60 shrink-0 flex items-center justify-center px-6">
          {logo && <img src={logo} alt="Business logo" className="max-h-14 max-w-[300px] object-contain" />}
        </div>

        {/* Page content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-[1400px] mx-auto px-6 pb-8">
            {children}
          </div>
        </div>
      </main>

      {/* Timmy the 10mm — the always-on AI helper */}
      <AssistantWidget />
    </div>
  )
}

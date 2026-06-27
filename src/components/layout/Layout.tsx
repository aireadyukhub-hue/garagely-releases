import { useState, useEffect } from 'react'
import { useLocation, Link } from 'react-router-dom'
import api from '@/lib/api'
import {
  LayoutDashboard, Users, Car, Wrench, FileText,
  Calendar, Package, BarChart3, Settings, ChevronLeft, ChevronRight,
  Quote, LogOut, Truck, LifeBuoy, HardHat, ListChecks, Menu, X
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
  { path: '/preset-jobs', label: 'Preset Jobs', icon: ListChecks },
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
  const [mobileOpen, setMobileOpen] = useState(false)   // off-canvas drawer (narrow screens)
  const [logo, setLogo] = useState<string | null>(null)
  const location = useLocation()

  // Customer's logo + brand accent for the top-centre header (refresh when saved).
  useEffect(() => {
    const lighten = (hex: string, amt = 22) => {
      const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
      if (!m) return hex
      const n = parseInt(m[1], 16)
      const r = Math.min(255, ((n >> 16) & 255) + amt)
      const g = Math.min(255, ((n >> 8) & 255) + amt)
      const b = Math.min(255, (n & 255) + amt)
      return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`
    }
    const loadSettings = () =>
      api.getSettings()
        .then((s) => {
          const cfg = (s || {}) as { logo_data?: string | null; accent_color?: string | null; ui_density?: string | null }
          setLogo(cfg.logo_data ?? null)
          const accent = cfg.accent_color || '#1F6FEB'
          document.documentElement.style.setProperty('--accent', accent)
          document.documentElement.style.setProperty('--accent-hover', lighten(accent))
          document.documentElement.dataset.density = cfg.ui_density || 'comfortable'
        })
        .catch(() => {})
    loadSettings()
    window.addEventListener('settings-updated', loadSettings)
    return () => window.removeEventListener('settings-updated', loadSettings)
  }, [])

  // Close the mobile drawer whenever the route changes.
  useEffect(() => { setMobileOpen(false) }, [location.pathname])

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/')

  return (
    <div className="flex h-screen bg-[#16181D] overflow-hidden">
      {/* Mobile drawer backdrop */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar — static column on lg+, off-canvas drawer below lg */}
      <aside
        className={cn(
          'flex flex-col bg-zinc-950/95 lg:bg-zinc-950/80 border-r border-zinc-800/60 transition-transform lg:transition-all duration-200 shrink-0',
          // mobile: fixed full-height drawer that slides in
          'fixed inset-y-0 left-0 z-50 w-[240px] lg:static lg:z-auto lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          // desktop width (collapsible)
          collapsed ? 'lg:w-[60px]' : 'lg:w-[220px]'
        )}
      >
        {/* Logo area. GarageLY branding kept in the corner; the customer's own
            logo (if set) shows top-centre via the main top bar. pt-5 clears the
            macOS traffic-light buttons on the desktop build. */}
        <div className={cn(
          'titlebar-drag flex items-center h-[84px] pt-5 border-b border-zinc-800/60 shrink-0',
          collapsed ? 'lg:justify-center lg:px-2 px-4' : 'px-4'
        )}>
          {collapsed ? (
            <>
              <img
                src="./assets/garagely-mark.svg"
                alt="GarageLY"
                className="w-11 h-11 titlebar-no-drag hidden lg:block"
                onError={(e) => { (e.target as HTMLImageElement).src = '/assets/garagely-mark.svg' }}
              />
              <img
                src="./assets/garagely-logo-dark.svg"
                alt="GarageLY"
                className="h-11 titlebar-no-drag lg:hidden"
                onError={(e) => { (e.target as HTMLImageElement).src = '/assets/garagely-logo-dark.svg' }}
              />
            </>
          ) : (
            <img
              src="./assets/garagely-logo-dark.svg"
              alt="GarageLY"
              className="h-11 titlebar-no-drag"
              onError={(e) => { (e.target as HTMLImageElement).src = '/assets/garagely-logo-dark.svg' }}
            />
          )}
          {/* Close button (mobile drawer only) */}
          <button onClick={() => setMobileOpen(false)} className="ml-auto text-zinc-500 hover:text-white lg:hidden titlebar-no-drag">
            <X className="w-5 h-5" />
          </button>
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
                collapsed ? 'lg:justify-center' : ''
              )}
            >
              <Icon className="w-[18px] h-[18px] shrink-0" />
              <span className={cn(collapsed ? 'lg:hidden' : '')}>{label}</span>
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
              collapsed ? 'lg:justify-center' : ''
            )}
          >
            <LogOut className="w-4 h-4" />
            <span className={cn(collapsed ? 'lg:hidden' : '')}>Sign out</span>
          </button>
          {/* Collapse toggle is desktop-only (drawer handles narrow screens) */}
          <button
            onClick={() => setCollapsed(c => !c)}
            className={cn(
              'w-full hidden lg:flex items-center gap-2 px-3 py-2 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors text-sm',
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
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top bar — hamburger (mobile) + customer's logo centred */}
        <div className="titlebar-drag h-[60px] lg:h-[84px] lg:pt-5 bg-[#0f1117] border-b border-zinc-800/60 shrink-0 flex items-center px-4 lg:px-6 relative">
          <button
            onClick={() => setMobileOpen(true)}
            className="text-zinc-300 hover:text-white lg:hidden titlebar-no-drag p-1 -ml-1"
            aria-label="Open menu"
          >
            <Menu className="w-6 h-6" />
          </button>
          {logo && (
            <img
              src={logo}
              alt="Business logo"
              className="max-h-10 lg:max-h-14 max-w-[200px] lg:max-w-[300px] object-contain absolute left-1/2 -translate-x-1/2"
            />
          )}
        </div>

        {/* Page content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6 pb-8">
            {children}
          </div>
        </div>
      </main>

      {/* Timmy the 10mm — the always-on AI helper */}
      <AssistantWidget />
    </div>
  )
}

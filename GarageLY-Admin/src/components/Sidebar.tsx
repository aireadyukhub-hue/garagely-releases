import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Key, UserPlus, LogOut } from 'lucide-react'

const links = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/licences', icon: Key, label: 'Licences' },
  { to: '/create-trial', icon: UserPlus, label: 'Create Trial' },
]

interface Props {
  onLogout: () => void
}

export default function Sidebar({ onLogout }: Props) {
  return (
    <aside className="w-56 bg-[#1F2128] border-r border-[#2A2D35] flex flex-col py-6 shrink-0">
      {/* Logo */}
      <div className="px-5 mb-8">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#F4A523] flex items-center justify-center">
            <Key className="w-4 h-4 text-[#16181D]" />
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-none">GarageLY</p>
            <p className="text-[#6B7280] text-xs mt-0.5">Admin</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-1">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-[#F4A523]/10 text-[#F4A523]'
                  : 'text-[#9CA3AF] hover:text-white hover:bg-[#2A2D35]'
              }`
            }
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <div className="px-3 mt-4">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[#9CA3AF] hover:text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>
    </aside>
  )
}

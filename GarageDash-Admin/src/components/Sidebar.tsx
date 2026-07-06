import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Key, UserPlus, LogOut, MessageSquare } from 'lucide-react'

const links = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/licences', icon: Key, label: 'Licences' },
  { to: '/submissions', icon: MessageSquare, label: 'Feedback & Support' },
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
        <img src="/assets/garagedash-logo-dark.png" alt="GarageDash" className="h-8" />
        <p className="text-[#6B7280] text-xs mt-1.5 pl-0.5">Admin</p>
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

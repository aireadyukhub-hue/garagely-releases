import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { Users, CheckCircle2, Clock, XCircle, TrendingUp, Loader2 } from 'lucide-react'

interface Stats {
  total: number
  active: number
  trial: number
  expired: number
  cancelled: number
}

interface StatCardProps {
  label: string
  value: number | string
  icon: React.ReactNode
  colour: string
}

function StatCard({ label, value, icon, colour }: StatCardProps) {
  return (
    <div className="bg-[#1F2128] border border-[#2A2D35] rounded-2xl p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[#9CA3AF] text-sm">{label}</p>
          <p className="text-3xl font-bold text-white mt-1">{value}</p>
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colour}`}>
          {icon}
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.getStats()
      .then((r) => setStats(r.stats))
      .catch((err) => setError(err.message))
  }, [])

  const mrr = stats ? stats.active * 29 : 0

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Dashboard</h1>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm mb-6">
          {error}
        </div>
      )}

      {!stats && !error && (
        <div className="flex items-center gap-2 text-[#9CA3AF]">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading…
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <StatCard
            label="Monthly Recurring Revenue"
            value={`£${mrr.toLocaleString()}`}
            icon={<TrendingUp className="w-5 h-5 text-[#F4A523]" />}
            colour="bg-[#F4A523]/10"
          />
          <StatCard
            label="Total Licences"
            value={stats.total}
            icon={<Users className="w-5 h-5 text-blue-400" />}
            colour="bg-blue-400/10"
          />
          <StatCard
            label="Active Subscriptions"
            value={stats.active}
            icon={<CheckCircle2 className="w-5 h-5 text-green-400" />}
            colour="bg-green-400/10"
          />
          <StatCard
            label="Free Trials"
            value={stats.trial}
            icon={<Clock className="w-5 h-5 text-yellow-400" />}
            colour="bg-yellow-400/10"
          />
          <StatCard
            label="Expired"
            value={stats.expired}
            icon={<XCircle className="w-5 h-5 text-red-400" />}
            colour="bg-red-400/10"
          />
          <StatCard
            label="Cancelled"
            value={stats.cancelled}
            icon={<XCircle className="w-5 h-5 text-[#6B7280]" />}
            colour="bg-[#6B7280]/10"
          />
        </div>
      )}
    </div>
  )
}

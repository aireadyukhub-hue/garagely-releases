import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { TrendingUp, Clock, AlertTriangle, FileText, Wrench, Calendar } from 'lucide-react'
import { formatCurrency, formatDate, JOB_STATUS_COLORS, JOB_STATUS_LABELS, isOverdue } from '@/lib/utils'
import api from '@/lib/api'
import { cn } from '@/lib/utils'

interface DashboardData {
  todayBookings: Array<{
    id: number; title: string; start_time: string; end_time: string
    first_name: string; last_name: string; registration: string; make: string; model: string
  }>
  jobsInProgress: Array<{
    id: number; job_number: string; title: string; status: string
    first_name: string; last_name: string; registration: string; make: string; model: string
  }>
  revenueThisMonth: number
  revenueLastMonth: number
  outstandingInvoices: { count: number; total: number }
  motAlerts: Array<{ id: number; registration: string; make: string; model: string; mot_due: string; first_name: string; last_name: string }>
  serviceAlerts: Array<{ id: number; registration: string; make: string; model: string; service_due: string; first_name: string; last_name: string }>
  recentJobs: Array<{
    id: number; job_number: string; title: string; status: string; updated_at: string
    first_name: string; last_name: string; registration: string
  }>
  jobStatusCounts: Array<{ status: string; count: number }>
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getDashboardData().then(d => {
      setData(d as DashboardData)
      setLoading(false)
    })
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!data) return null

  const revenueChange = data.revenueLastMonth > 0
    ? ((data.revenueThisMonth - data.revenueLastMonth) / data.revenueLastMonth) * 100
    : 0

  const today = new Date()
  const dateStr = today.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="pt-2">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{dateStr}</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500 uppercase tracking-wide font-medium">Revenue (Month)</span>
            <TrendingUp className="w-4 h-4 text-zinc-600" />
          </div>
          <span className="text-2xl font-semibold text-white">{formatCurrency(data.revenueThisMonth)}</span>
          <span className={cn('text-xs font-medium', revenueChange >= 0 ? 'text-green-400' : 'text-red-400')}>
            {revenueChange >= 0 ? '↑' : '↓'} {Math.abs(revenueChange).toFixed(0)}% vs last month
          </span>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500 uppercase tracking-wide font-medium">Outstanding</span>
            <FileText className="w-4 h-4 text-zinc-600" />
          </div>
          <span className="text-2xl font-semibold text-white">{formatCurrency(data.outstandingInvoices.total)}</span>
          <span className="text-xs text-zinc-500">{data.outstandingInvoices.count} unpaid invoice{data.outstandingInvoices.count !== 1 ? 's' : ''}</span>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500 uppercase tracking-wide font-medium">Today's Bookings</span>
            <Calendar className="w-4 h-4 text-zinc-600" />
          </div>
          <span className="text-2xl font-semibold text-white">{data.todayBookings.length}</span>
          <span className="text-xs text-zinc-500">scheduled today</span>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500 uppercase tracking-wide font-medium">Active Jobs</span>
            <Wrench className="w-4 h-4 text-zinc-600" />
          </div>
          <span className="text-2xl font-semibold text-white">{data.jobsInProgress.length}</span>
          <span className="text-xs text-zinc-500">in progress / awaiting parts</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        {/* Today's bookings */}
        <div className="card col-span-2">
          <div className="card-header flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-200">Today's Bookings</span>
            <Link to="/calendar" className="text-xs text-blue-400 hover:text-blue-300">View calendar →</Link>
          </div>
          <div>
            {data.todayBookings.length === 0 ? (
              <div className="px-5 py-8 text-center text-zinc-500 text-sm">No bookings today</div>
            ) : (
              data.todayBookings.map(b => (
                <div key={b.id} className="flex items-center gap-4 px-5 py-3 border-b border-zinc-800/50 last:border-0 hover:bg-zinc-800/30 transition-colors">
                  <div className="text-xs font-mono text-zinc-400 w-24 shrink-0">
                    {new Date(b.start_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    {' – '}
                    {new Date(b.end_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-200 truncate">{b.title}</p>
                    <p className="text-xs text-zinc-500">{b.first_name} {b.last_name} · {b.registration} {b.make} {b.model}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Alerts */}
        <div className="space-y-4">
          {/* MOT alerts */}
          {data.motAlerts.length > 0 && (
            <div className="card">
              <div className="card-header">
                <span className="text-sm font-medium text-amber-400 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> MOT Due Soon ({data.motAlerts.length})
                </span>
              </div>
              <div>
                {data.motAlerts.slice(0, 4).map(v => (
                  <Link key={v.id} to={`/vehicles/${v.id}`} className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800/50 last:border-0 hover:bg-zinc-800/30 transition-colors">
                    <div>
                      <p className="text-sm font-medium text-zinc-200">{v.registration}</p>
                      <p className="text-xs text-zinc-500">{v.first_name} {v.last_name}</p>
                    </div>
                    <span className={cn('text-xs font-medium', isOverdue(v.mot_due) ? 'text-red-400' : 'text-amber-400')}>
                      {formatDate(v.mot_due)}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Service alerts */}
          {data.serviceAlerts.length > 0 && (
            <div className="card">
              <div className="card-header">
                <span className="text-sm font-medium text-orange-400 flex items-center gap-2">
                  <Clock className="w-4 h-4" /> Service Due ({data.serviceAlerts.length})
                </span>
              </div>
              <div>
                {data.serviceAlerts.slice(0, 4).map(v => (
                  <Link key={v.id} to={`/vehicles/${v.id}`} className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800/50 last:border-0 hover:bg-zinc-800/30 transition-colors">
                    <div>
                      <p className="text-sm font-medium text-zinc-200">{v.registration}</p>
                      <p className="text-xs text-zinc-500">{v.first_name} {v.last_name}</p>
                    </div>
                    <span className={cn('text-xs font-medium', isOverdue(v.service_due) ? 'text-red-400' : 'text-orange-400')}>
                      {formatDate(v.service_due)}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Active jobs + recent activity */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-200">Active Jobs</span>
            <Link to="/jobs?status=in_progress" className="text-xs text-blue-400 hover:text-blue-300">View all →</Link>
          </div>
          <div>
            {data.jobsInProgress.length === 0 ? (
              <div className="px-5 py-8 text-center text-zinc-500 text-sm">No active jobs</div>
            ) : (
              data.jobsInProgress.map(j => (
                <Link key={j.id} to={`/jobs/${j.id}`} className="flex items-center gap-3 px-5 py-3 border-b border-zinc-800/50 last:border-0 hover:bg-zinc-800/30 transition-colors">
                  <span className={cn('status-badge shrink-0', JOB_STATUS_COLORS[j.status])}>
                    {JOB_STATUS_LABELS[j.status]}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-200 truncate">{j.title}</p>
                    <p className="text-xs text-zinc-500">{j.job_number} · {j.registration} · {j.first_name} {j.last_name}</p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-200">Recent Activity</span>
            <Link to="/jobs" className="text-xs text-blue-400 hover:text-blue-300">View all →</Link>
          </div>
          <div>
            {data.recentJobs.map(j => (
              <Link key={j.id} to={`/jobs/${j.id}`} className="flex items-center gap-3 px-5 py-3 border-b border-zinc-800/50 last:border-0 hover:bg-zinc-800/30 transition-colors">
                <span className={cn('status-badge shrink-0', JOB_STATUS_COLORS[j.status])}>
                  {JOB_STATUS_LABELS[j.status]}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-200 truncate">{j.title}</p>
                  <p className="text-xs text-zinc-500">{j.registration} · {j.first_name} {j.last_name}</p>
                </div>
                <span className="text-xs text-zinc-600 shrink-0">{formatDate(j.updated_at)}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

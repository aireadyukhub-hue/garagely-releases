import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts'
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns'
import api from '@/lib/api'
import { formatCurrency, JOB_STATUS_LABELS, cn } from '@/lib/utils'

const PRESETS = [
  { label: 'This Month', from: () => format(startOfMonth(new Date()), 'yyyy-MM-dd'), to: () => format(endOfMonth(new Date()), 'yyyy-MM-dd') },
  { label: 'Last 30 Days', from: () => format(subDays(new Date(), 30), 'yyyy-MM-dd'), to: () => format(new Date(), 'yyyy-MM-dd') },
  { label: 'Last 90 Days', from: () => format(subDays(new Date(), 90), 'yyyy-MM-dd'), to: () => format(new Date(), 'yyyy-MM-dd') },
  { label: 'This Year', from: () => `${new Date().getFullYear()}-01-01`, to: () => format(new Date(), 'yyyy-MM-dd') },
]

const PIE_COLORS = ['#1F6FEB', '#3B82F6', '#60A5FA', '#93C5FD', '#BFDBFE', '#DBEAFE']
const STATUS_COLORS: Record<string, string> = {
  booked: '#3B82F6', in_progress: '#F59E0B', awaiting_parts: '#F97316',
  complete: '#22C55E', invoiced: '#A855F7'
}

export default function Reports() {
  const [preset, setPreset] = useState(0)
  const [from, setFrom] = useState(PRESETS[0].from())
  const [to, setTo] = useState(PRESETS[0].to())
  const [revenue, setRevenue] = useState<{ daily: Array<{ date: string; revenue: number }>; byStatus: Array<{ status: string; count: number; total: number }>; total: number } | null>(null)
  const [jobs, setJobs] = useState<{ byStatus: Array<{ status: string; count: number }>; byTechnician: Array<{ assigned_to: string; count: number }>; recent: unknown[] } | null>(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    const [rev, j] = await Promise.all([
      api.getRevenueReport(from, to),
      api.getJobsReport(from, to),
    ])
    setRevenue(rev as typeof revenue)
    setJobs(j as typeof jobs)
    setLoading(false)
  }

  useEffect(() => { load() }, [from, to])

  const applyPreset = (idx: number) => {
    setPreset(idx)
    setFrom(PRESETS[idx].from())
    setTo(PRESETS[idx].to())
  }

  const totalJobs = (jobs?.byStatus || []).reduce((s, j) => s + j.count, 0)

  return (
    <div className="pt-2">
      <div className="page-header">
        <h1 className="page-title">Reports</h1>
      </div>

      {/* Date filters */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-1">
          {PRESETS.map((p, i) => (
            <button key={p.label} onClick={() => applyPreset(i)}
              className={cn('px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                preset === i ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
              )}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input type="date" className="input w-40 text-xs py-1.5" value={from} onChange={e => { setFrom(e.target.value); setPreset(-1) }} />
          <span className="text-zinc-500 text-sm">—</span>
          <input type="date" className="input w-40 text-xs py-1.5" value={to} onChange={e => { setTo(e.target.value); setPreset(-1) }} />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-5">
          {/* Revenue summary */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Revenue (Paid)', value: formatCurrency(revenue?.total || 0) },
              { label: 'Total Jobs', value: totalJobs.toString() },
              { label: 'Avg Job Value', value: totalJobs > 0 ? formatCurrency((revenue?.total || 0) / totalJobs) : '—' },
              { label: 'Outstanding', value: formatCurrency((revenue?.byStatus || []).find(s => s.status === 'unpaid')?.total || 0) },
            ].map(s => (
              <div key={s.label} className="stat-card">
                <span className="text-xs text-zinc-500 uppercase tracking-wide font-medium">{s.label}</span>
                <span className="text-2xl font-semibold text-white">{s.value}</span>
              </div>
            ))}
          </div>

          {/* Revenue chart */}
          {(revenue?.daily || []).length > 0 && (
            <div className="card p-5">
              <h3 className="text-sm font-medium text-zinc-300 mb-4">Daily Revenue</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={revenue?.daily || []} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="date" tick={{ fill: '#71717a', fontSize: 11 }} tickFormatter={d => d.slice(5)} />
                  <YAxis tick={{ fill: '#71717a', fontSize: 11 }} tickFormatter={v => `£${v}`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '8px', color: '#e4e4e7' }}
                    formatter={(v: number) => [formatCurrency(v), 'Revenue']}
                  />
                  <Bar dataKey="revenue" fill="#1F6FEB" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Jobs by status */}
            <div className="card p-5">
              <h3 className="text-sm font-medium text-zinc-300 mb-4">Jobs by Status</h3>
              {(jobs?.byStatus || []).length === 0 ? (
                <p className="text-zinc-500 text-sm">No data</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={jobs?.byStatus || []} cx="50%" cy="50%" outerRadius={80} dataKey="count" nameKey="status"
                      label={({ status, count }: { status: string; count: number }) => `${JOB_STATUS_LABELS[status] || status}: ${count}`}
                    >
                      {(jobs?.byStatus || []).map((entry) => (
                        <Cell key={entry.status} fill={STATUS_COLORS[entry.status] || '#6b7280'} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '8px', color: '#e4e4e7' }}
                      formatter={(_v: unknown, name: string) => [_v, JOB_STATUS_LABELS[name] || name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Jobs by technician */}
            <div className="card p-5">
              <h3 className="text-sm font-medium text-zinc-300 mb-4">Jobs by Technician</h3>
              {(jobs?.byTechnician || []).length === 0 ? (
                <p className="text-zinc-500 text-sm">No data</p>
              ) : (
                <div className="space-y-3">
                  {(jobs?.byTechnician || []).map((t) => {
                    const pct = totalJobs > 0 ? (t.count / totalJobs * 100) : 0
                    return (
                      <div key={t.assigned_to}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-zinc-300">{t.assigned_to || 'Unassigned'}</span>
                          <span className="text-zinc-400">{t.count} jobs</span>
                        </div>
                        <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                          <div className="h-full bg-[#1F6FEB] rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

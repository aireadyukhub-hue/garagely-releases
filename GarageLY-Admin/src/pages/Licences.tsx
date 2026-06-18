import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { format } from 'date-fns'
import { Search, RefreshCw, Ban, CheckCircle2, Loader2, ChevronDown } from 'lucide-react'

interface Licence {
  id: string
  key: string
  email: string
  garage_name: string
  status: string
  trial_ends_at: string | null
  current_period_end: string | null
  created_at: string
}

const STATUS_COLOURS: Record<string, string> = {
  active:    'bg-green-400/10 text-green-400 border-green-400/20',
  trial:     'bg-yellow-400/10 text-yellow-400 border-yellow-400/20',
  expired:   'bg-red-400/10 text-red-400 border-red-400/20',
  cancelled: 'bg-[#6B7280]/10 text-[#6B7280] border-[#6B7280]/20',
}

export default function Licences() {
  const [licences, setLicences] = useState<Licence[]>([])
  const [filtered, setFiltered] = useState<Licence[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionKey, setActionKey] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const r = await api.listLicences(statusFilter || undefined)
      setLicences(r.licences || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [statusFilter])

  useEffect(() => {
    const q = search.toLowerCase()
    setFiltered(licences.filter((l) =>
      l.key.toLowerCase().includes(q) ||
      l.email.toLowerCase().includes(q) ||
      l.garage_name.toLowerCase().includes(q)
    ))
  }, [search, licences])

  async function handleRevoke(key: string) {
    if (!confirm(`Revoke licence ${key}? The garage will lose access immediately.`)) return
    setActionKey(key)
    try {
      await api.revokeLicence(key)
      await load()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setActionKey(null)
    }
  }

  async function handleReactivate(key: string) {
    setActionKey(key)
    try {
      await api.updateLicence(key, { status: 'active' })
      await load()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setActionKey(null)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Licences</h1>
        <button onClick={load} className="flex items-center gap-2 text-[#9CA3AF] hover:text-white text-sm">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
          <input
            type="text"
            placeholder="Search key, email, garage…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#1F2128] border border-[#2A2D35] rounded-xl pl-9 pr-4 py-2.5 text-white text-sm placeholder-[#4B5563] focus:outline-none focus:border-[#F4A523]"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-[#1F2128] border border-[#2A2D35] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#F4A523]"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="trial">Trial</option>
          <option value="expired">Expired</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-[#9CA3AF]">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="bg-[#1F2128] border border-[#2A2D35] rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2A2D35]">
                {['Licence Key', 'Garage', 'Email', 'Status', 'Expires', 'Created', 'Actions'].map((h) => (
                  <th key={h} className="text-left text-[#6B7280] font-medium px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center text-[#6B7280] py-10">No licences found</td>
                </tr>
              )}
              {filtered.map((l) => (
                <tr key={l.id} className="border-b border-[#2A2D35] last:border-0 hover:bg-[#2A2D35]/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-white">{l.key}</td>
                  <td className="px-4 py-3 text-white">{l.garage_name}</td>
                  <td className="px-4 py-3 text-[#9CA3AF]">{l.email}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLOURS[l.status] || 'text-white'}`}>
                      {l.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#9CA3AF] text-xs">
                    {l.current_period_end
                      ? format(new Date(l.current_period_end), 'd MMM yyyy')
                      : l.trial_ends_at
                      ? format(new Date(l.trial_ends_at), 'd MMM yyyy')
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-[#9CA3AF] text-xs">
                    {format(new Date(l.created_at), 'd MMM yyyy')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {actionKey === l.key ? (
                        <Loader2 className="w-4 h-4 animate-spin text-[#9CA3AF]" />
                      ) : l.status === 'cancelled' || l.status === 'expired' ? (
                        <button
                          onClick={() => handleReactivate(l.key)}
                          className="flex items-center gap-1 text-xs text-green-400 hover:text-green-300"
                          title="Reactivate"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Reactivate
                        </button>
                      ) : (
                        <button
                          onClick={() => handleRevoke(l.key)}
                          className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300"
                          title="Revoke"
                        >
                          <Ban className="w-3.5 h-3.5" /> Revoke
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

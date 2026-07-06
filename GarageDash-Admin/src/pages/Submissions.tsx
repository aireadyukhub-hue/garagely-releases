import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { format } from 'date-fns'
import { RefreshCw, Loader2, MessageSquare, LifeBuoy, Lightbulb, Mail } from 'lucide-react'

interface Submission {
  id: number
  garage_id: number
  garage_name: string | null
  type: string
  subject: string | null
  message: string
  status: string
  contact_email: string | null
  created_at: string
}

const STATUS_COLOURS: Record<string, string> = {
  new:    'bg-blue-400/10 text-blue-400 border-blue-400/20',
  open:   'bg-yellow-400/10 text-yellow-400 border-yellow-400/20',
  closed: 'bg-green-400/10 text-green-400 border-green-400/20',
}
const STATUSES = ['new', 'open', 'closed']

export default function Submissions() {
  const [items, setItems] = useState<Submission[]>([])
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const r = await api.listSubmissions({
        type: typeFilter || undefined,
        status: statusFilter || undefined,
      })
      setItems(r.submissions || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [typeFilter, statusFilter])

  async function setStatus(id: number, status: string) {
    setBusyId(id)
    try {
      await api.updateSubmission(id, status)
      setItems((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)))
    } catch (err: any) {
      alert(err.message)
    } finally {
      setBusyId(null)
    }
  }

  const newCount = items.filter((s) => s.status === 'new').length

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-white">Feedback &amp; Support</h1>
          {newCount > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-blue-400/10 text-blue-400 border-blue-400/20">
              {newCount} new
            </span>
          )}
        </div>
        <button onClick={load} className="flex items-center gap-2 text-[#9CA3AF] hover:text-white text-sm">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="bg-[#1F2128] border border-[#2A2D35] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#F4A523]"
        >
          <option value="">All types</option>
          <option value="feedback">Feedback / ideas</option>
          <option value="support">Support</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-[#1F2128] border border-[#2A2D35] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#F4A523]"
        >
          <option value="">All statuses</option>
          <option value="new">New</option>
          <option value="open">Open</option>
          <option value="closed">Closed</option>
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
      ) : items.length === 0 ? (
        <div className="bg-[#1F2128] border border-[#2A2D35] rounded-2xl py-16 flex flex-col items-center text-[#6B7280]">
          <MessageSquare className="w-8 h-8 mb-3 opacity-50" />
          Nothing here yet
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((s) => {
            const isSupport = s.type === 'support'
            return (
              <div key={s.id} className="bg-[#1F2128] border border-[#2A2D35] rounded-2xl p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${
                        isSupport
                          ? 'bg-purple-400/10 text-purple-400 border-purple-400/20'
                          : 'bg-[#F4A523]/10 text-[#F4A523] border-[#F4A523]/20'
                      }`}>
                        {isSupport ? <LifeBuoy className="w-3 h-3" /> : <Lightbulb className="w-3 h-3" />}
                        {isSupport ? 'Support' : 'Feedback'}
                      </span>
                      <span className="text-white font-semibold truncate">{s.subject || '(no subject)'}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-[#6B7280]">
                      <span className="text-[#9CA3AF]">{s.garage_name || `Garage #${s.garage_id}`}</span>
                      {s.contact_email && (
                        <a href={`mailto:${s.contact_email}`} className="inline-flex items-center gap-1 text-[#9CA3AF] hover:text-[#F4A523]">
                          <Mail className="w-3 h-3" /> {s.contact_email}
                        </a>
                      )}
                      <span>{format(new Date(s.created_at), 'd MMM yyyy, HH:mm')}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLOURS[s.status] || 'text-white'}`}>
                      {s.status}
                    </span>
                  </div>
                </div>

                <p className="text-sm text-[#D1D5DB] mt-3 whitespace-pre-wrap">{s.message}</p>

                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-[#2A2D35]">
                  {busyId === s.id ? (
                    <Loader2 className="w-4 h-4 animate-spin text-[#9CA3AF]" />
                  ) : (
                    <>
                      <span className="text-xs text-[#6B7280] mr-1">Set status:</span>
                      {STATUSES.map((st) => (
                        <button
                          key={st}
                          onClick={() => setStatus(s.id, st)}
                          disabled={s.status === st}
                          className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                            s.status === st
                              ? `${STATUS_COLOURS[st]} cursor-default`
                              : 'border-[#2A2D35] text-[#9CA3AF] hover:text-white hover:border-[#4B5563]'
                          }`}
                        >
                          {st}
                        </button>
                      ))}
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

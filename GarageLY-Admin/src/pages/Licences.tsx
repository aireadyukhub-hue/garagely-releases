import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { format } from 'date-fns'
import { Search, RefreshCw, Ban, CheckCircle2, Loader2, Pencil, Mail, KeyRound, X } from 'lucide-react'

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

const inputCls = 'w-full bg-[#15171C] border border-[#2A2D35] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#F4A523]'

export default function Licences() {
  const [licences, setLicences] = useState<Licence[]>([])
  const [filtered, setFiltered] = useState<Licence[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionKey, setActionKey] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; kind: 'ok' | 'err' } | null>(null)

  // Edit modal
  const [editing, setEditing] = useState<Licence | null>(null)
  const [editForm, setEditForm] = useState({ garage_name: '', status: 'active', expiry: '' })
  const [savingEdit, setSavingEdit] = useState(false)

  // Reset-password result (when email isn't configured we surface the link)
  const [resetLink, setResetLink] = useState<{ email: string; link: string } | null>(null)

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

  function flash(msg: string, kind: 'ok' | 'err' = 'ok') {
    setToast({ msg, kind })
    setTimeout(() => setToast(null), 4000)
  }

  async function run(key: string, fn: () => Promise<any>, okMsg?: string) {
    setActionKey(key)
    try {
      await fn()
      if (okMsg) flash(okMsg, 'ok')
      await load()
    } catch (err: any) {
      flash(err.message, 'err')
    } finally {
      setActionKey(null)
    }
  }

  const suspend = (l: Licence) => {
    if (!confirm(`Suspend ${l.garage_name}? They'll lose access until reactivated.`)) return
    run(l.key, () => api.revokeLicence(l.key), 'Account suspended')
  }
  const reactivate = (l: Licence) => run(l.key, () => api.updateLicence(l.key, { status: 'active' }), 'Account reactivated')
  const resendKey = (l: Licence) => run(l.key, async () => {
    const r = await api.resendKey(l.key)
    flash(`Licence key emailed to ${r.sent_to}`, 'ok')
  })
  const resetPassword = (l: Licence) => run(l.key, async () => {
    const r = await api.resetPassword(l.key)
    if (r.emailed) flash(`Password reset link emailed to ${r.sent_to}`, 'ok')
    else if (r.reset_link) setResetLink({ email: r.sent_to, link: r.reset_link })
  })

  function openEdit(l: Licence) {
    setEditForm({
      garage_name: l.garage_name || '',
      status: l.status,
      expiry: (l.current_period_end || l.trial_ends_at || '').slice(0, 10),
    })
    setEditing(l)
  }

  async function saveEdit() {
    if (!editing) return
    setSavingEdit(true)
    try {
      await api.updateLicence(editing.key, {
        garageName: editForm.garage_name,
        status: editForm.status,
        ...(editForm.expiry ? { trialEndsAt: new Date(editForm.expiry + 'T23:59:59').toISOString() } : {}),
      })
      setEditing(null)
      flash('Account updated', 'ok')
      await load()
    } catch (err: any) {
      flash(err.message, 'err')
    } finally {
      setSavingEdit(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Licences &amp; Accounts</h1>
        <button onClick={load} className="flex items-center gap-2 text-[#9CA3AF] hover:text-white text-sm">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {toast && (
        <div className={`mb-4 rounded-xl px-4 py-3 text-sm border ${toast.kind === 'ok'
          ? 'bg-green-500/10 border-green-500/20 text-green-400'
          : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
          {toast.msg}
        </div>
      )}

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
          <option value="cancelled">Suspended / cancelled</option>
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
        <div className="bg-[#1F2128] border border-[#2A2D35] rounded-2xl overflow-x-auto">
          <table className="w-full text-sm min-w-[820px]">
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
              {filtered.map((l) => {
                const suspended = l.status === 'cancelled' || l.status === 'expired'
                return (
                  <tr key={l.id} className="border-b border-[#2A2D35] last:border-0 hover:bg-[#2A2D35]/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-white">{l.key}</td>
                    <td className="px-4 py-3 text-white">{l.garage_name}</td>
                    <td className="px-4 py-3 text-[#9CA3AF]">{l.email}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLOURS[l.status] || 'text-white'}`}>
                        {l.status === 'cancelled' ? 'suspended' : l.status}
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
                      {actionKey === l.key ? (
                        <Loader2 className="w-4 h-4 animate-spin text-[#9CA3AF]" />
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => openEdit(l)} title="Edit details & plan"
                            className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-white hover:bg-[#2A2D35]"><Pencil className="w-3.5 h-3.5" /></button>
                          <button onClick={() => resetPassword(l)} title="Send password reset"
                            className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-white hover:bg-[#2A2D35]"><KeyRound className="w-3.5 h-3.5" /></button>
                          <button onClick={() => resendKey(l)} title="Resend licence key by email"
                            className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-white hover:bg-[#2A2D35]"><Mail className="w-3.5 h-3.5" /></button>
                          {suspended ? (
                            <button onClick={() => reactivate(l)} title="Reactivate"
                              className="p-1.5 rounded-lg text-green-400 hover:bg-[#2A2D35]"><CheckCircle2 className="w-3.5 h-3.5" /></button>
                          ) : (
                            <button onClick={() => suspend(l)} title="Suspend"
                              className="p-1.5 rounded-lg text-red-400 hover:bg-[#2A2D35]"><Ban className="w-3.5 h-3.5" /></button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setEditing(null) }}>
          <div className="bg-[#1F2128] border border-[#2A2D35] rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#2A2D35]">
              <h2 className="text-base font-semibold text-white">Edit account</h2>
              <button onClick={() => setEditing(null)} className="text-[#6B7280] hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="text-xs text-[#6B7280] font-mono">{editing.key} · {editing.email}</div>
              <div>
                <label className="block text-xs text-[#9CA3AF] mb-1.5">Garage name</label>
                <input className={inputCls} value={editForm.garage_name} onChange={(e) => setEditForm(f => ({ ...f, garage_name: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs text-[#9CA3AF] mb-1.5">Status / plan</label>
                <select className={inputCls} value={editForm.status} onChange={(e) => setEditForm(f => ({ ...f, status: e.target.value }))}>
                  <option value="active">Active</option>
                  <option value="trial">Trial</option>
                  <option value="expired">Expired</option>
                  <option value="cancelled">Suspended / cancelled</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-[#9CA3AF] mb-1.5">Expiry date</label>
                <input type="date" className={inputCls} value={editForm.expiry} onChange={(e) => setEditForm(f => ({ ...f, expiry: e.target.value }))} />
                <p className="text-[11px] text-[#6B7280] mt-1">Sets the trial/period end. Leave blank to keep the current date.</p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[#2A2D35]">
              <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-lg text-sm text-[#9CA3AF] hover:text-white">Cancel</button>
              <button onClick={saveEdit} disabled={savingEdit}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-[#F4A523] text-[#111] hover:brightness-105 disabled:opacity-60">
                {savingEdit ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset-link fallback (email not configured) */}
      {resetLink && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setResetLink(null) }}>
          <div className="bg-[#1F2128] border border-[#2A2D35] rounded-2xl w-full max-w-lg p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-white">Password reset link</h2>
              <button onClick={() => setResetLink(null)} className="text-[#6B7280] hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-sm text-[#9CA3AF] mb-3">Email isn't configured, so send this link to <strong className="text-white">{resetLink.email}</strong> yourself:</p>
            <textarea readOnly value={resetLink.link} className={inputCls + ' h-24 font-mono text-xs'} onFocus={(e) => e.currentTarget.select()} />
            <div className="flex justify-end mt-3">
              <button onClick={() => { navigator.clipboard?.writeText(resetLink.link); flash('Link copied', 'ok') }}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-[#F4A523] text-[#111] hover:brightness-105">Copy link</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

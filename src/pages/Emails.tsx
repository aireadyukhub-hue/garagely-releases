import { useEffect, useState } from 'react'
import { Plus, Trash2, Send, Mail, Users as UsersIcon, CalendarClock, Clock } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import api from '@/lib/api'
import { Customer, EmailCampaign, CampaignAudience } from '@/types'
import { formatDateTime, cn } from '@/lib/utils'

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
  scheduled: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  sending: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  sent: 'bg-green-500/20 text-green-400 border-green-500/30',
  failed: 'bg-red-500/20 text-red-400 border-red-500/30',
  cancelled: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
}
const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft', scheduled: 'Scheduled', sending: 'Sending…', sent: 'Sent', failed: 'Failed', cancelled: 'Cancelled',
}

type EditForm = {
  id?: number
  subject: string
  body: string
  audience: CampaignAudience
  customer_ids: number[]
  scheduled_at: string   // datetime-local string, '' = send immediately
}
const EMPTY: EditForm = { subject: '', body: '', audience: 'all', customer_ids: [], scheduled_at: '' }

export default function Emails() {
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<EditForm>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [sendingId, setSendingId] = useState<number | null>(null)

  const load = () => Promise.all([
    api.getCampaigns().then(d => setCampaigns(d as EmailCampaign[])),
    api.getCustomers().then(d => setCustomers((d as Customer[]).filter(c => c.email))),
  ]).then(() => setLoading(false))

  useEffect(() => { load() }, [])

  const openNew = () => { setForm(EMPTY); setModalOpen(true) }
  const openEdit = (c: EmailCampaign) => {
    setForm({
      id: c.id, subject: c.subject, body: c.body, audience: c.audience,
      customer_ids: c.audience_filter?.customer_ids || [],
      scheduled_at: c.scheduled_at ? c.scheduled_at.slice(0, 16) : '',
    })
    setModalOpen(true)
  }

  const handleSave = async (andSendNow = false) => {
    if (!form.subject.trim() || !form.body.trim()) return
    setSaving(true)
    try {
      const payload = {
        subject: form.subject.trim(),
        body: form.body.trim(),
        audience: form.audience,
        audience_filter: form.audience === 'custom' ? { customer_ids: form.customer_ids } : {},
        scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : null,
        status: form.scheduled_at && !andSendNow ? 'scheduled' : 'draft',
      }
      const saved = form.id
        ? await api.updateCampaign(form.id, payload)
        : await api.createCampaign(payload)
      setModalOpen(false)
      await load()
      if (andSendNow) await sendNow((saved as EmailCampaign).id)
    } finally {
      setSaving(false)
    }
  }

  const sendNow = async (id: number) => {
    setSendingId(id)
    try {
      const res = await api.sendCampaignNow(id) as { sent: number }
      await load()
      alert(`Sent to ${res.sent} recipient${res.sent === 1 ? '' : 's'}.`)
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setSendingId(null)
    }
  }

  const handleDelete = async (c: EmailCampaign) => {
    if (!confirm(`Delete "${c.subject}"?`)) return
    await api.deleteCampaign(c.id)
    await load()
  }

  const toggleCustomer = (id: number) =>
    setForm(f => ({ ...f, customer_ids: f.customer_ids.includes(id) ? f.customer_ids.filter(x => x !== id) : [...f.customer_ids, id] }))

  const audienceCount = form.audience === 'all' ? customers.length : form.customer_ids.length

  return (
    <div className="pt-2">
      <div className="page-header">
        <div>
          <h1 className="page-title">Emails</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Blast an announcement to your customers, or schedule a newsletter for later.</p>
        </div>
        <button onClick={openNew} className="btn-primary"><Plus className="w-4 h-4" /> New Email</button>
      </div>

      {loading ? (
        <div className="text-zinc-500 text-sm py-10 text-center">Loading…</div>
      ) : campaigns.length === 0 ? (
        <div className="card">
          <div className="py-14 text-center text-zinc-500">
            <Mail className="w-8 h-8 mx-auto mb-3 text-zinc-600" />
            <p className="text-sm">No emails yet.</p>
            <p className="text-xs mt-1">Send a one-off blast, or schedule a newsletter for a future date.</p>
            <button onClick={openNew} className="btn-secondary mt-4 mx-auto"><Plus className="w-4 h-4" /> New Email</button>
          </div>
        </div>
      ) : (
        <div className="card">
          {campaigns.map(c => (
            <div key={c.id} className="flex items-center gap-4 px-5 py-3.5 border-b border-zinc-800/50 last:border-0">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-zinc-200 truncate">{c.subject}</p>
                  <span className={cn('status-badge shrink-0', STATUS_COLORS[c.status])}>{STATUS_LABELS[c.status]}</span>
                </div>
                <p className="text-xs text-zinc-500 mt-0.5 flex items-center gap-3 flex-wrap">
                  <span className="flex items-center gap-1"><UsersIcon className="w-3 h-3" /> {c.audience === 'all' ? 'All customers' : `${c.audience_filter?.customer_ids?.length || 0} selected`}</span>
                  {c.status === 'scheduled' && c.scheduled_at && <span className="flex items-center gap-1"><CalendarClock className="w-3 h-3" /> Sends {formatDateTime(c.scheduled_at)}</span>}
                  {c.status === 'sent' && c.sent_at && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Sent {formatDateTime(c.sent_at)} · {c.recipient_count} recipient{c.recipient_count === 1 ? '' : 's'}</span>}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {c.status !== 'sent' && (
                  <>
                    <button onClick={() => openEdit(c)} className="btn-ghost text-xs py-1.5 px-2.5">Edit</button>
                    <button onClick={() => sendNow(c.id)} disabled={sendingId === c.id} className="btn-secondary text-xs py-1.5 px-2.5">
                      <Send className="w-3.5 h-3.5" /> {sendingId === c.id ? 'Sending…' : 'Send Now'}
                    </button>
                  </>
                )}
                <button onClick={() => handleDelete(c)} className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800" title="Delete">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={form.id ? 'Edit Email' : 'New Email'} size="lg"
        footer={<>
          <button onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
          <button onClick={() => handleSave(false)} disabled={saving || !form.subject.trim() || !form.body.trim()} className="btn-secondary">
            {form.scheduled_at ? 'Save Schedule' : 'Save Draft'}
          </button>
          <button onClick={() => handleSave(true)} disabled={saving || !form.subject.trim() || !form.body.trim() || audienceCount === 0} className="btn-primary">
            <Send className="w-4 h-4" /> Send Now
          </button>
        </>}>
        <div className="space-y-4">
          <div><label className="label">Subject</label><input className="input" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="e.g. We're open bank holiday Monday" /></div>
          <div>
            <label className="label">Message</label>
            <textarea className="textarea" rows={6} value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
              placeholder={'Hi {{first_name}},\n\n…'} />
            <p className="text-xs text-zinc-600 mt-1">Use <code className="text-zinc-400">{'{{first_name}}'}</code> to personalise each email.</p>
          </div>

          <div>
            <label className="label">Audience</label>
            <div className="flex items-center gap-4 mb-2">
              <label className="flex items-center gap-2 cursor-pointer text-sm text-zinc-300">
                <input type="radio" checked={form.audience === 'all'} onChange={() => setForm(f => ({ ...f, audience: 'all' }))} className="accent-[#F4A523]" />
                All customers with an email ({customers.length})
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm text-zinc-300">
                <input type="radio" checked={form.audience === 'custom'} onChange={() => setForm(f => ({ ...f, audience: 'custom' }))} className="accent-[#F4A523]" />
                Choose customers
              </label>
            </div>
            {form.audience === 'custom' && (
              <div className="max-h-40 overflow-y-auto border border-zinc-800 rounded-lg p-2 space-y-1">
                {customers.map(c => (
                  <label key={c.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-zinc-800/50 cursor-pointer text-sm text-zinc-300">
                    <input type="checkbox" checked={form.customer_ids.includes(c.id)} onChange={() => toggleCustomer(c.id)} className="accent-[#F4A523]" />
                    {c.first_name} {c.last_name} <span className="text-zinc-600 text-xs">({c.email})</span>
                  </label>
                ))}
                {customers.length === 0 && <p className="text-xs text-zinc-600 px-2 py-1">No customers with an email address yet.</p>}
              </div>
            )}
          </div>

          <div>
            <label className="label">Schedule (optional)</label>
            <input type="datetime-local" className="input max-w-xs" value={form.scheduled_at} onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))} />
            <p className="text-xs text-zinc-600 mt-1">Leave blank to send immediately with "Send Now". Set a date to save it as a scheduled newsletter — it goes out automatically that day.</p>
          </div>
        </div>
      </Modal>
    </div>
  )
}

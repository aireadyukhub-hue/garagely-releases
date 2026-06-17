import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, ArrowRight } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import api from '@/lib/api'
import { Quote, Customer, Vehicle } from '@/types'
import { formatDate, formatCurrency, QUOTE_STATUS_COLORS, cn, calcTotals } from '@/lib/utils'

const STATUS_LABELS: Record<string, string> = { draft: 'Draft', sent: 'Sent', accepted: 'Accepted', rejected: 'Rejected', converted: 'Converted' }
const EMPTY_Q = { customer_id: 0, vehicle_id: 0, status: 'draft', title: '', vat_rate: 20, notes: '', valid_until: '', lineItems: [{ description: '', quantity: 1, unit_price: 0, total: 0 }] }

export default function Quotes() {
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<Partial<typeof EMPTY_Q>>(EMPTY_Q)
  const [saving, setSaving] = useState(false)
  const [converting, setConverting] = useState<number | null>(null)

  const load = () => api.getQuotes().then(d => setQuotes(d as Quote[]))
  useEffect(() => {
    load()
    api.getCustomers().then(d => setCustomers(d as Customer[]))
    api.getVehicles().then(d => setVehicles(d as Vehicle[]))
  }, [])

  const filtered = quotes.filter(q =>
    `${q.quote_number} ${q.first_name} ${q.last_name} ${q.title}`
      .toLowerCase().includes(search.toLowerCase())
  )

  const subtotal = (form.lineItems || []).reduce((s, l) => s + (l.quantity * l.unit_price), 0)
  const { vat_amount, total } = calcTotals(subtotal, form.vat_rate || 20)

  const handleSave = async () => {
    setSaving(true)
    const lineItems = (form.lineItems || []).map(l => ({ ...l, total: l.quantity * l.unit_price }))
    await api.createQuote({ ...form, subtotal, vat_amount, total, lineItems })
    setModalOpen(false)
    await load()
    setSaving(false)
  }

  const handleConvert = async (id: number) => {
    setConverting(id)
    await api.convertQuoteToJob(id)
    await load()
    setConverting(null)
  }

  const customerVehicles = vehicles.filter(v => v.customer_id === form.customer_id)

  return (
    <div className="pt-2">
      <div className="page-header">
        <h1 className="page-title">Quotes / Estimates</h1>
        <button onClick={() => { setForm(EMPTY_Q); setModalOpen(true) }} className="btn-primary">
          <Plus className="w-4 h-4" /> New Quote
        </button>
      </div>

      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input className="input pl-9" placeholder="Search quotes…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800">
              {['Quote #', 'Title', 'Customer', 'Vehicle', 'Status', 'Total', 'Valid Until', 'Actions'].map(h => (
                <th key={h} className="text-left px-5 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={8} className="px-5 py-10 text-center text-zinc-500">No quotes found</td></tr>
            ) : filtered.map(q => (
              <tr key={q.id} className="border-b border-zinc-800/50 last:border-0">
                <td className="px-5 py-3.5 font-mono text-xs text-blue-400">{q.quote_number}</td>
                <td className="px-5 py-3.5 text-zinc-200">{q.title || '—'}</td>
                <td className="px-5 py-3.5 text-zinc-300">{q.first_name} {q.last_name}</td>
                <td className="px-5 py-3.5 font-mono text-xs text-zinc-400">{q.registration || '—'}</td>
                <td className="px-5 py-3.5">
                  <span className={cn('status-badge', QUOTE_STATUS_COLORS[q.status])}>{STATUS_LABELS[q.status]}</span>
                </td>
                <td className="px-5 py-3.5 font-medium text-zinc-200">{formatCurrency(q.total)}</td>
                <td className="px-5 py-3.5 text-zinc-500 text-xs">{formatDate(q.valid_until)}</td>
                <td className="px-5 py-3.5">
                  {q.status !== 'converted' && (
                    <button onClick={() => handleConvert(q.id)} disabled={converting === q.id}
                      className="btn-ghost text-xs py-1 px-2 text-blue-400 hover:text-blue-300">
                      <ArrowRight className="w-3.5 h-3.5" />
                      {converting === q.id ? 'Converting…' : 'Convert to Job'}
                    </button>
                  )}
                  {q.converted_job_id && (
                    <Link to={`/jobs/${q.converted_job_id}`} className="text-xs text-zinc-500 hover:text-zinc-300">View Job →</Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* New quote modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Quote" size="xl"
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleSave} disabled={saving || !form.customer_id} className="btn-primary">
              {saving ? 'Saving…' : 'Create Quote'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div><label className="label">Title</label><input className="input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Timing Belt Replacement" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Customer *</label>
              <select className="select" value={form.customer_id || ''} onChange={e => setForm(f => ({ ...f, customer_id: Number(e.target.value), vehicle_id: 0 }))}>
                <option value="">Select…</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Vehicle</label>
              <select className="select" value={form.vehicle_id || ''} onChange={e => setForm(f => ({ ...f, vehicle_id: Number(e.target.value) }))} disabled={!form.customer_id}>
                <option value="">Select…</option>
                {customerVehicles.map(v => <option key={v.id} value={v.id}>{v.registration} – {v.make} {v.model}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Status</label>
              <select className="select" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                {['draft', 'sent', 'accepted', 'rejected'].map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>
            </div>
            <div><label className="label">Valid Until</label><input type="date" className="input" value={form.valid_until} onChange={e => setForm(f => ({ ...f, valid_until: e.target.value }))} /></div>
            <div><label className="label">VAT Rate (%)</label><input type="number" className="input" value={form.vat_rate} onChange={e => setForm(f => ({ ...f, vat_rate: Number(e.target.value) }))} /></div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Line Items</label>
              <button onClick={() => setForm(f => ({ ...f, lineItems: [...(f.lineItems || []), { description: '', quantity: 1, unit_price: 0, total: 0 }] }))} className="btn-ghost text-xs py-1 px-2">+ Add line</button>
            </div>
            <div className="space-y-2">
              {(form.lineItems || []).map((item, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_80px_100px_36px] gap-2">
                  <input className="input text-xs py-1.5" value={item.description} placeholder="Description"
                    onChange={e => setForm(f => ({ ...f, lineItems: f.lineItems!.map((l, i) => i === idx ? { ...l, description: e.target.value } : l) }))} />
                  <input type="number" className="input text-xs py-1.5" value={item.quantity} placeholder="Qty"
                    onChange={e => setForm(f => ({ ...f, lineItems: f.lineItems!.map((l, i) => i === idx ? { ...l, quantity: Number(e.target.value) } : l) }))} />
                  <input type="number" className="input text-xs py-1.5" value={item.unit_price} placeholder="Price"
                    onChange={e => setForm(f => ({ ...f, lineItems: f.lineItems!.map((l, i) => i === idx ? { ...l, unit_price: Number(e.target.value) } : l) }))} />
                  <button onClick={() => setForm(f => ({ ...f, lineItems: f.lineItems!.filter((_, i) => i !== idx) }))} className="btn-ghost p-1 text-red-400">×</button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-6 pt-2 border-t border-zinc-800 text-sm">
            <span className="text-zinc-500">Subtotal: <span className="text-zinc-200 font-medium">{formatCurrency(subtotal)}</span></span>
            <span className="text-zinc-500">VAT: <span className="text-zinc-200 font-medium">{formatCurrency(vat_amount)}</span></span>
            <span className="text-zinc-500">Total: <span className="text-white font-bold text-base">{formatCurrency(total)}</span></span>
          </div>

          <div><label className="label">Notes</label><textarea className="textarea" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
        </div>
      </Modal>
    </div>
  )
}

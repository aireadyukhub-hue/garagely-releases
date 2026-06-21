import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, Download } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import NumberField from '@/components/ui/NumberField'
import api from '@/lib/api'
import { Invoice, Customer, Job } from '@/types'
import { formatDate, formatCurrency, INVOICE_STATUS_COLORS, INVOICE_STATUS_LABELS, cn, calcTotals } from '@/lib/utils'

const STATUSES = ['all', 'draft', 'unpaid', 'paid', 'overdue']
const EMPTY_INV = { customer_id: 0, job_id: null, status: 'unpaid', vat_rate: 20, notes: '', due_date: '', lineItems: [{ description: '', quantity: 1, unit_price: 0, total: 0 }] }

export default function Invoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<Partial<typeof EMPTY_INV>>(EMPTY_INV)
  const [saving, setSaving] = useState(false)

  const load = () => api.getInvoices().then(d => setInvoices(d as Invoice[]))
  useEffect(() => {
    load()
    api.getCustomers().then(d => setCustomers(d as Customer[]))
    api.getJobs().then(d => setJobs(d as Job[]))
  }, [])

  const filtered = invoices.filter(i => {
    const matchStatus = statusFilter === 'all' || i.status === statusFilter
    const matchSearch = `${i.invoice_number} ${i.first_name} ${i.last_name} ${i.job_number}`
      .toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchSearch
  })

  const subtotal = (form.lineItems || []).reduce((s, l) => s + (l.quantity * l.unit_price), 0)
  const { vat_amount, total } = calcTotals(subtotal, form.vat_rate || 20)

  const handleSave = async () => {
    setSaving(true)
    const lineItems = (form.lineItems || []).map(l => ({ ...l, total: l.quantity * l.unit_price }))
    await api.createInvoice({ ...form, subtotal, vat_amount, total, lineItems })
    setModalOpen(false)
    setForm(EMPTY_INV)
    await load()
    setSaving(false)
  }

  return (
    <div className="pt-2">
      <div className="page-header">
        <h1 className="page-title">Invoices</h1>
        <button onClick={() => { setForm(EMPTY_INV); setModalOpen(true) }} className="btn-primary">
          <Plus className="w-4 h-4" /> New Invoice
        </button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        {[
          { label: 'Total Invoiced', value: formatCurrency(invoices.reduce((s, i) => s + i.total, 0)), sub: `${invoices.length} invoices` },
          { label: 'Outstanding', value: formatCurrency(invoices.filter(i => i.status === 'unpaid').reduce((s, i) => s + i.total, 0)), sub: `${invoices.filter(i => i.status === 'unpaid').length} unpaid` },
          { label: 'Paid', value: formatCurrency(invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.total, 0)), sub: `${invoices.filter(i => i.status === 'paid').length} paid` },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <span className="text-xs text-zinc-500 uppercase tracking-wide font-medium">{s.label}</span>
            <span className="text-2xl font-semibold text-white">{s.value}</span>
            <span className="text-xs text-zinc-500">{s.sub}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input className="input pl-9" placeholder="Search invoices…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-1">
          {STATUSES.map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={cn('px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize',
                statusFilter === s ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
              )}>
              {s === 'all' ? 'All' : INVOICE_STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800">
              {['Invoice #', 'Customer', 'Job', 'Status', 'Subtotal', 'VAT', 'Total', 'Due', 'Paid'].map(h => (
                <th key={h} className="text-left px-5 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={9} className="px-5 py-10 text-center text-zinc-500">No invoices found</td></tr>
            ) : filtered.map(inv => (
              <tr key={inv.id} className="table-row-hover border-b border-zinc-800/50 last:border-0">
                <td className="px-5 py-3.5">
                  <Link to={`/invoices/${inv.id}`} className="font-mono text-blue-400 hover:text-blue-300 text-xs">{inv.invoice_number}</Link>
                </td>
                <td className="px-5 py-3.5 text-zinc-300">{inv.first_name} {inv.last_name}</td>
                <td className="px-5 py-3.5 text-zinc-500 text-xs font-mono">{inv.job_number || '—'}</td>
                <td className="px-5 py-3.5">
                  <span className={cn('status-badge', INVOICE_STATUS_COLORS[inv.status])}>{INVOICE_STATUS_LABELS[inv.status]}</span>
                </td>
                <td className="px-5 py-3.5 text-zinc-400">{formatCurrency(inv.subtotal)}</td>
                <td className="px-5 py-3.5 text-zinc-500">{formatCurrency(inv.vat_amount)}</td>
                <td className="px-5 py-3.5 font-semibold text-zinc-200">{formatCurrency(inv.total)}</td>
                <td className="px-5 py-3.5 text-zinc-500 text-xs">{formatDate(inv.due_date)}</td>
                <td className="px-5 py-3.5 text-green-400 text-xs">{formatDate(inv.paid_date)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* New invoice modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Invoice" size="xl"
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleSave} disabled={saving || !form.customer_id} className="btn-primary">
              {saving ? 'Saving…' : 'Create Invoice'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Customer *</label>
              <select className="select" value={form.customer_id || ''} onChange={e => setForm(f => ({ ...f, customer_id: Number(e.target.value) }))}>
                <option value="">Select…</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Related Job</label>
              <select className="select" value={form.job_id || ''} onChange={e => setForm(f => ({ ...f, job_id: Number(e.target.value) || null }))}>
                <option value="">None</option>
                {jobs.filter(j => !form.customer_id || j.customer_id === form.customer_id).map(j => (
                  <option key={j.id} value={j.id}>{j.job_number} – {j.title}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Status</label>
              <select className="select" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                {['draft', 'unpaid', 'paid'].map(s => <option key={s} value={s}>{INVOICE_STATUS_LABELS[s]}</option>)}
              </select>
            </div>
            <div><label className="label">Due Date</label><input type="date" className="input" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} /></div>
            <div><label className="label">VAT Rate (%)</label><NumberField className="input" value={form.vat_rate} onChange={n => setForm(f => ({ ...f, vat_rate: n }))} /></div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Line Items</label>
              <button onClick={() => setForm(f => ({ ...f, lineItems: [...(f.lineItems || []), { description: '', quantity: 1, unit_price: 0, total: 0 }] }))} className="btn-ghost text-xs py-1 px-2">+ Add line</button>
            </div>
            <div className="space-y-2">
              {(form.lineItems || []).map((item, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_80px_100px_36px] gap-2">
                  <input className="input text-xs py-1.5" value={item.description} onChange={e => setForm(f => ({ ...f, lineItems: f.lineItems!.map((l, i) => i === idx ? { ...l, description: e.target.value } : l) }))} placeholder="Description" />
                  <NumberField className="input text-xs py-1.5" value={item.quantity} decimal={false} onChange={n => setForm(f => ({ ...f, lineItems: f.lineItems!.map((l, i) => i === idx ? { ...l, quantity: n } : l) }))} placeholder="Qty" />
                  <NumberField className="input text-xs py-1.5" value={item.unit_price} onChange={n => setForm(f => ({ ...f, lineItems: f.lineItems!.map((l, i) => i === idx ? { ...l, unit_price: n } : l) }))} placeholder="Price" />
                  <button onClick={() => setForm(f => ({ ...f, lineItems: f.lineItems!.filter((_, i) => i !== idx) }))} className="btn-ghost p-1 text-red-400">×</button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-8 pt-2 border-t border-zinc-800 text-sm">
            <div className="text-zinc-500">Subtotal: <span className="text-zinc-200 font-medium">{formatCurrency(subtotal)}</span></div>
            <div className="text-zinc-500">VAT ({form.vat_rate}%): <span className="text-zinc-200 font-medium">{formatCurrency(vat_amount)}</span></div>
            <div className="text-zinc-500">Total: <span className="text-white font-bold text-base">{formatCurrency(total)}</span></div>
          </div>

          <div><label className="label">Notes</label><textarea className="textarea" rows={2} value={form.notes || ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
        </div>
      </Modal>
    </div>
  )
}

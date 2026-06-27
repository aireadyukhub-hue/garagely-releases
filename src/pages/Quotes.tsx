import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, ArrowRight } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import NumberField from '@/components/ui/NumberField'
import api from '@/lib/api'
import { Quote, Customer, Vehicle, PresetJob } from '@/types'
import NewCustomerButton from '@/components/NewCustomerButton'
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
  const [labourRate, setLabourRate] = useState(65)
  const [technicians, setTechnicians] = useState<{ id: number; name: string; colour: string }[]>([])
  const [slotJob, setSlotJob] = useState<any>(null)
  const [slot, setSlot] = useState({ day: '', time: '09:00', technician_id: null as number | null })
  const [presets, setPresets] = useState<PresetJob[]>([])
  const [presetPickerOpen, setPresetPickerOpen] = useState(false)
  const [pickedPresets, setPickedPresets] = useState<number[]>([])
  const [defaultNotes, setDefaultNotes] = useState('')

  const load = () => api.getQuotes().then(d => setQuotes(d as Quote[]))
  useEffect(() => {
    load()
    api.getCustomers().then(d => setCustomers(d as Customer[]))
    api.getVehicles().then(d => setVehicles(d as Vehicle[]))
    api.getTechnicians().then(d => setTechnicians(d as { id: number; name: string; colour: string }[])).catch(() => {})
    api.getPresetJobs().then(d => setPresets(d as PresetJob[])).catch(() => {})
    api.getSettings().then(s => {
      const cfg = (s || {}) as { labour_rate?: number; quote_notes?: string; vat_rate?: number }
      if (cfg.labour_rate) setLabourRate(cfg.labour_rate)
      if (cfg.quote_notes) setDefaultNotes(cfg.quote_notes)
    }).catch(() => {})
  }, [])

  const openNewQuote = () => {
    setForm({ ...EMPTY_Q, notes: defaultNotes })
    setModalOpen(true)
  }

  // Drop the line items of the ticked presets into the quote.
  const addPickedPresets = () => {
    const chosen = presets.filter(p => pickedPresets.includes(p.id))
    const newLines = chosen.flatMap(p =>
      (p.items || []).map(it => ({
        description: it.description,
        quantity: Number(it.quantity) || 1,
        unit_price: Number(it.unit_price) || 0,
        total: (Number(it.quantity) || 1) * (Number(it.unit_price) || 0),
      }))
    )
    if (newLines.length) {
      setForm(f => {
        // Drop the single blank starter row if it's still empty.
        const existing = (f.lineItems || []).filter(l => l.description.trim() || l.unit_price)
        return { ...f, lineItems: [...existing, ...newLines] }
      })
    }
    // If the quote has no title yet, name it after the chosen presets.
    if (chosen.length && !form.title) {
      setForm(f => ({ ...f, title: chosen.map(c => c.name).join(' + ') }))
    }
    setPickedPresets([])
    setPresetPickerOpen(false)
  }

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

  const handleConvert = async (id: number, target: 'job' | 'invoice') => {
    setConverting(id)
    if (target === 'job') {
      const job = await api.convertQuoteToJob(id)
      await load()
      setConverting(null)
      // Offer to book the new job sheet straight into the calendar.
      setSlot({ day: new Date().toISOString().slice(0, 10), time: '09:00', technician_id: null })
      setSlotJob(job)
    } else {
      await api.convertQuoteToInvoice(id)
      await load()
      setConverting(null)
    }
  }

  const bookSlot = async () => {
    if (!slotJob || !slot.day) { setSlotJob(null); return }
    const h = Number(slot.time.slice(0, 2))
    const start = `${slot.day}T${slot.time}:00`
    const end = `${slot.day}T${String(Math.min(h + 1, 23)).padStart(2, '0')}:${slot.time.slice(3, 5)}:00`
    await api.createBooking({
      title: slotJob.title || `Job ${slotJob.job_number || ''}`.trim(),
      start_time: start, end_time: end,
      customer_id: slotJob.customer_id, vehicle_id: slotJob.vehicle_id || null,
      job_id: slotJob.id, technician_id: slot.technician_id, status: 'confirmed',
    })
    if (slot.technician_id) await api.updateJob(slotJob.id, { technician_id: slot.technician_id })
    setSlotJob(null)
  }

  const customerVehicles = vehicles.filter(v => v.customer_id === form.customer_id)

  return (
    <div className="pt-2">
      <div className="page-header">
        <h1 className="page-title">Quotes / Estimates</h1>
        <button onClick={openNewQuote} className="btn-primary">
          <Plus className="w-4 h-4" /> New Quote
        </button>
      </div>

      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input className="input pl-9" placeholder="Search quotes…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
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
                  {q.status !== 'converted' ? (
                    converting === q.id ? (
                      <span className="text-xs text-zinc-500">Converting…</span>
                    ) : (
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleConvert(q.id, 'job')}
                          className="btn-ghost text-xs py-1 px-2 text-blue-400 hover:text-blue-300 inline-flex items-center gap-1">
                          <ArrowRight className="w-3.5 h-3.5" /> Job sheet
                        </button>
                        <button onClick={() => handleConvert(q.id, 'invoice')}
                          className="btn-ghost text-xs py-1 px-2 text-green-400 hover:text-green-300 inline-flex items-center gap-1">
                          <ArrowRight className="w-3.5 h-3.5" /> Invoice
                        </button>
                      </div>
                    )
                  ) : (
                    <span className="flex items-center gap-2 text-xs">
                      {q.converted_job_id && (
                        <Link to={`/jobs/${q.converted_job_id}`} className="text-zinc-400 hover:text-zinc-200">View Job →</Link>
                      )}
                    </span>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between">
                <label className="label">Customer *</label>
                <NewCustomerButton onCreated={c => { setCustomers(cs => [...cs, c]); setForm(f => ({ ...f, customer_id: c.id, vehicle_id: 0 })) }} />
              </div>
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="label">Status</label>
              <select className="select" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                {['draft', 'sent', 'accepted', 'rejected'].map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>
            </div>
            <div><label className="label">Valid Until</label><input type="date" className="input" value={form.valid_until} onChange={e => setForm(f => ({ ...f, valid_until: e.target.value }))} /></div>
            <div><label className="label">VAT Rate (%)</label><NumberField className="input" value={form.vat_rate} onChange={n => setForm(f => ({ ...f, vat_rate: n }))} /></div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Line Items</label>
              <div className="flex items-center gap-1">
                <button onClick={() => { setPickedPresets([]); setPresetPickerOpen(true) }} className="btn-ghost text-xs py-1 px-2 text-[#F4A523]">+ Preset job</button>
                <button onClick={() => setForm(f => ({ ...f, lineItems: [...(f.lineItems || []), { description: 'Labour', quantity: 1, unit_price: labourRate, total: labourRate }] }))} className="btn-ghost text-xs py-1 px-2 text-blue-400">+ Labour</button>
                <button onClick={() => setForm(f => ({ ...f, lineItems: [...(f.lineItems || []), { description: '', quantity: 1, unit_price: 0, total: 0 }] }))} className="btn-ghost text-xs py-1 px-2">+ Part / line</button>
              </div>
            </div>
            <div className="space-y-2">
              {(form.lineItems || []).map((item, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_80px_100px_36px] gap-2">
                  <input className="input text-xs py-1.5" value={item.description} placeholder="Description"
                    onChange={e => setForm(f => ({ ...f, lineItems: f.lineItems!.map((l, i) => i === idx ? { ...l, description: e.target.value } : l) }))} />
                  <NumberField className="input text-xs py-1.5" value={item.quantity} decimal={false} placeholder="Qty"
                    onChange={n => setForm(f => ({ ...f, lineItems: f.lineItems!.map((l, i) => i === idx ? { ...l, quantity: n } : l) }))} />
                  <NumberField className="input text-xs py-1.5" value={item.unit_price} placeholder="Price"
                    onChange={n => setForm(f => ({ ...f, lineItems: f.lineItems!.map((l, i) => i === idx ? { ...l, unit_price: n } : l) }))} />
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

      {/* Slot picker after quote → job conversion */}
      <Modal open={!!slotJob} onClose={() => setSlotJob(null)} title="Book this job in?"
        footer={<>
          <button onClick={() => setSlotJob(null)} className="btn-secondary">Skip</button>
          <button onClick={bookSlot} disabled={!slot.day} className="btn-primary">Add to calendar</button>
        </>}>
        <div className="space-y-4">
          <p className="text-sm text-zinc-400">
            Job sheet <span className="font-mono text-blue-400">{slotJob?.job_number}</span> created. Want to book it into the calendar now? (You can skip and do it later.)
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="label">Date</label><input type="date" className="input" value={slot.day} onChange={e => setSlot(s => ({ ...s, day: e.target.value }))} /></div>
            <div><label className="label">Start time</label><input type="time" className="input" value={slot.time} onChange={e => setSlot(s => ({ ...s, time: e.target.value }))} /></div>
          </div>
          <div>
            <label className="label">Technician</label>
            <select className="select" value={slot.technician_id || ''} onChange={e => setSlot(s => ({ ...s, technician_id: e.target.value ? Number(e.target.value) : null }))}>
              <option value="">Unassigned</option>
              {technicians.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        </div>
      </Modal>

      {/* Preset-job picker — tick several saved jobs to drop their lines into the quote */}
      <Modal open={presetPickerOpen} onClose={() => setPresetPickerOpen(false)} title="Add preset jobs" size="lg"
        footer={<>
          <button onClick={() => setPresetPickerOpen(false)} className="btn-secondary">Cancel</button>
          <button onClick={addPickedPresets} disabled={pickedPresets.length === 0} className="btn-primary">
            Add {pickedPresets.length || ''} to quote
          </button>
        </>}>
        {presets.length === 0 ? (
          <div className="text-center py-8 text-sm text-zinc-500">
            No preset jobs yet. Create some on the <Link to="/preset-jobs" className="text-[#F4A523] hover:underline">Preset Jobs</Link> page first.
          </div>
        ) : (
          <div className="space-y-2 max-h-[55vh] overflow-y-auto">
            <p className="text-xs text-zinc-500 mb-1">Tick the jobs the customer wants — all their parts &amp; labour lines get added.</p>
            {presets.map(p => {
              const picked = pickedPresets.includes(p.id)
              const tot = (p.items || []).reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), 0)
              return (
                <label key={p.id} className={cn('flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                  picked ? 'border-[#F4A523]/60 bg-[#F4A523]/10' : 'border-zinc-700 hover:border-zinc-600')}>
                  <input type="checkbox" checked={picked} className="accent-[#F4A523] w-4 h-4 mt-0.5"
                    onChange={e => setPickedPresets(ids => e.target.checked ? [...ids, p.id] : ids.filter(i => i !== p.id))} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-zinc-100">{p.name}</span>
                      <span className="text-sm font-semibold text-zinc-200 shrink-0">{formatCurrency(tot)}</span>
                    </div>
                    {p.category && <span className="text-[11px] text-[#F4A523]">{p.category}</span>}
                    <div className="text-xs text-zinc-500 mt-0.5">{(p.items || []).length} line{(p.items || []).length !== 1 ? 's' : ''}: {(p.items || []).map(it => it.description).filter(Boolean).slice(0, 4).join(', ')}{(p.items || []).length > 4 ? '…' : ''}</div>
                  </div>
                </label>
              )
            })}
          </div>
        )}
      </Modal>
    </div>
  )
}

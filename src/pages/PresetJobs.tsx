import { useEffect, useState } from 'react'
import { Plus, Search, Pencil, Trash2, ListChecks, BadgePoundSterling } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import NumberField from '@/components/ui/NumberField'
import api from '@/lib/api'
import { PresetJob, PresetJobItem } from '@/types'
import { formatCurrency, depositAmount } from '@/lib/utils'

type EditItem = PresetJobItem
type EditForm = {
  id?: number
  name: string
  category: string
  description: string
  labour_hours: number
  items: EditItem[]
  deposit_required: boolean
  deposit_type: 'fixed' | 'percent'
  deposit_value: number
}

const EMPTY: EditForm = {
  name: '', category: '', description: '', labour_hours: 0,
  items: [{ type: 'part', description: '', quantity: 1, unit_price: 0 }],
  deposit_required: false, deposit_type: 'fixed', deposit_value: 0,
}

// Starter labour-times library — common UK jobs at typical real-world hours.
// One-click seeds these as preset jobs (parts left blank; labour auto-prices at
// the garage's rate). Edit/refine after adding. Hours are sensible defaults.
const STARTER_JOBS: { name: string; category: string; labour_hours: number }[] = [
  { name: 'Front brake pads (per axle)', category: 'Brakes', labour_hours: 0.8 },
  { name: 'Front brake pads & discs (per axle)', category: 'Brakes', labour_hours: 1.2 },
  { name: 'Rear brake pads (per axle)', category: 'Brakes', labour_hours: 1.0 },
  { name: 'Rear brake shoes', category: 'Brakes', labour_hours: 1.5 },
  { name: 'Full service', category: 'Servicing', labour_hours: 1.5 },
  { name: 'Interim / oil & filter service', category: 'Servicing', labour_hours: 0.8 },
  { name: 'Cambelt / timing belt', category: 'Engine', labour_hours: 3.0 },
  { name: 'Cambelt + water pump', category: 'Engine', labour_hours: 3.5 },
  { name: 'Clutch replacement', category: 'Transmission', labour_hours: 5.0 },
  { name: 'Water pump', category: 'Cooling', labour_hours: 2.0 },
  { name: 'Thermostat', category: 'Cooling', labour_hours: 1.0 },
  { name: 'Radiator', category: 'Cooling', labour_hours: 1.5 },
  { name: 'Alternator', category: 'Electrical', labour_hours: 1.5 },
  { name: 'Starter motor', category: 'Electrical', labour_hours: 1.5 },
  { name: 'Battery replacement', category: 'Electrical', labour_hours: 0.3 },
  { name: 'Front shock absorber (each)', category: 'Suspension', labour_hours: 1.0 },
  { name: 'Front wishbone / control arm (each)', category: 'Suspension', labour_hours: 1.2 },
  { name: 'Front wheel bearing (each)', category: 'Suspension', labour_hours: 1.5 },
  { name: 'Exhaust back box', category: 'Exhaust', labour_hours: 0.6 },
  { name: 'Diagnostic / fault investigation', category: 'Diagnostics', labour_hours: 1.0 },
]

export default function PresetJobs() {
  const [presets, setPresets] = useState<PresetJob[]>([])
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<EditForm>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [labourRate, setLabourRate] = useState(65)
  const [loading, setLoading] = useState(true)
  const [defaultDeposit, setDefaultDeposit] = useState<{ type: 'fixed' | 'percent'; value: number }>({ type: 'fixed', value: 0 })

  const load = () => api.getPresetJobs().then(d => { setPresets(d as PresetJob[]); setLoading(false) })
  useEffect(() => {
    load()
    api.getSettings().then(s => {
      const cfg = s as { labour_rate?: number; default_deposit_type?: 'fixed' | 'percent'; default_deposit_value?: number }
      if (cfg?.labour_rate) setLabourRate(cfg.labour_rate)
      setDefaultDeposit({ type: cfg?.default_deposit_type || 'fixed', value: cfg?.default_deposit_value || 0 })
    }).catch(() => {})
  }, [])

  const filtered = presets.filter(p =>
    `${p.name} ${p.category} ${p.description}`.toLowerCase().includes(search.toLowerCase())
  )

  const presetTotal = (p: PresetJob) =>
    (p.items || []).reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), 0)
    + (Number(p.labour_hours) || 0) * labourRate
  const formTotal = form.items.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), 0)
    + (Number(form.labour_hours) || 0) * labourRate

  const [seeding, setSeeding] = useState(false)

  const openNew = () => {
    setForm({
      ...EMPTY, items: [{ type: 'part', description: '', quantity: 1, unit_price: 0 }],
      deposit_type: defaultDeposit.type, deposit_value: defaultDeposit.value,
    })
    setModalOpen(true)
  }
  const openEdit = (p: PresetJob) => {
    setForm({
      id: p.id, name: p.name, category: p.category || '', description: p.description || '',
      labour_hours: Number(p.labour_hours) || 0,
      items: (p.items || []).map(it => ({ type: it.type, description: it.description, quantity: it.quantity, unit_price: it.unit_price })),
      deposit_required: !!p.deposit_required, deposit_type: p.deposit_type || 'fixed', deposit_value: Number(p.deposit_value) || 0,
    })
    setModalOpen(true)
  }

  // One-click: seed the common UK jobs (skips any already present by name).
  const addStarterLibrary = async () => {
    if (!confirm('Add the starter set of common UK jobs with typical labour hours? You can edit or delete any of them after.')) return
    setSeeding(true)
    try {
      const existing = new Set(presets.map(p => p.name.toLowerCase()))
      for (const j of STARTER_JOBS) {
        if (existing.has(j.name.toLowerCase())) continue
        await api.createPresetJob({ name: j.name, category: j.category, description: '', labour_hours: j.labour_hours, items: [] })
      }
      await load()
    } finally {
      setSeeding(false)
    }
  }

  const setItem = (idx: number, patch: Partial<EditItem>) =>
    setForm(f => ({ ...f, items: f.items.map((it, i) => i === idx ? { ...it, ...patch } : it) }))

  const handleSave = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    const payload = {
      name: form.name.trim(), category: form.category.trim(), description: form.description.trim(),
      labour_hours: Number(form.labour_hours) || 0,
      items: form.items.filter(it => it.description.trim()),
      deposit_required: form.deposit_required, deposit_type: form.deposit_type, deposit_value: Number(form.deposit_value) || 0,
    }
    if (form.id) await api.updatePresetJob(form.id, payload)
    else await api.createPresetJob(payload)
    setModalOpen(false)
    setSaving(false)
    await load()
  }

  const handleDelete = async (p: PresetJob) => {
    if (!confirm(`Delete preset "${p.name}"? This won't affect quotes you've already made.`)) return
    await api.deletePresetJob(p.id)
    await load()
  }

  return (
    <div className="pt-2">
      <div className="page-header">
        <div>
          <h1 className="page-title">Preset Jobs</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Build the jobs you quote often, then drop them straight into a quote.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={addStarterLibrary} disabled={seeding} className="btn-secondary">{seeding ? 'Adding…' : '+ Common UK jobs'}</button>
          <button onClick={openNew} className="btn-primary"><Plus className="w-4 h-4" /> New Preset Job</button>
        </div>
      </div>

      <div className="relative mb-5 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input className="input pl-9" placeholder="Search preset jobs…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="text-zinc-500 text-sm py-10 text-center">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <div className="py-14 text-center text-zinc-500">
            <ListChecks className="w-8 h-8 mx-auto mb-3 text-zinc-600" />
            <p className="text-sm">No preset jobs yet.</p>
            <p className="text-xs mt-1">Create your first one — e.g. “Fit MQB intercooler”, “Fit downpipe”, “Stage 1 tune”.</p>
            <button onClick={openNew} className="btn-secondary mt-4 mx-auto"><Plus className="w-4 h-4" /> New Preset Job</button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(p => (
            <div key={p.id} className="card flex flex-col">
              <div className="card-header flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-zinc-100 truncate">{p.name}</div>
                  {p.category && <div className="text-[11px] text-[#F4A523] mt-0.5">{p.category}</div>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => handleDelete(p)} className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              <div className="card-body flex-1 space-y-1.5">
                {p.description && <p className="text-xs text-zinc-500 mb-2">{p.description}</p>}
                {Number(p.labour_hours) > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-blue-400">{p.labour_hours} hr labour</span>
                    <span className="text-zinc-400 font-mono shrink-0">{formatCurrency((Number(p.labour_hours) || 0) * labourRate)}</span>
                  </div>
                )}
                {(p.items || []).length === 0 && !(Number(p.labour_hours) > 0) ? (
                  <p className="text-xs text-zinc-600">No line items.</p>
                ) : (p.items || []).map((it, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-zinc-400 truncate pr-2">
                      <span className={it.type === 'labour' ? 'text-blue-400' : 'text-zinc-500'}>{it.quantity}×</span> {it.description}
                    </span>
                    <span className="text-zinc-400 font-mono shrink-0">{formatCurrency((Number(it.quantity) || 0) * (Number(it.unit_price) || 0))}</span>
                  </div>
                ))}
              </div>
              <div className="px-5 py-3 border-t border-zinc-800 flex items-center justify-between">
                <span className="text-xs text-zinc-500">Total (ex VAT)</span>
                <span className="text-sm font-semibold text-white">{formatCurrency(presetTotal(p))}</span>
              </div>
              {p.deposit_required && (
                <div className="px-5 py-2 border-t border-zinc-800 flex items-center gap-1.5 text-xs text-[#F4A523]">
                  <BadgePoundSterling className="w-3.5 h-3.5" />
                  {p.deposit_type === 'percent'
                    ? `${p.deposit_value}% deposit (${formatCurrency(depositAmount(p, presetTotal(p)))})`
                    : `${formatCurrency(depositAmount(p, presetTotal(p)))} deposit to book`}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={form.id ? 'Edit Preset Job' : 'New Preset Job'} size="xl"
        footer={<>
          <button onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
          <button onClick={handleSave} disabled={saving || !form.name.trim()} className="btn-primary">{saving ? 'Saving…' : 'Save Preset'}</button>
        </>}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="label">Job name *</label><input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Fit MQB intercooler" /></div>
            <div><label className="label">Category</label><input className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="e.g. Tuning" /></div>
          </div>
          <div><label className="label">Description</label><input className="input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional note shown on the card" /></div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Labour hours</label>
              <NumberField className="input" value={form.labour_hours} onChange={n => setForm(f => ({ ...f, labour_hours: n }))} placeholder="e.g. 1.5" />
            </div>
            <div className="flex items-end">
              <p className="text-xs text-zinc-500 pb-2">Auto-prices at your labour rate (£{labourRate}/hr) when added to a quote = <span className="text-zinc-300 font-medium">{formatCurrency((Number(form.labour_hours) || 0) * labourRate)}</span></p>
            </div>
          </div>

          <div className="p-3 rounded-lg border border-zinc-800 bg-zinc-900/40 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-zinc-300">
              <input type="checkbox" checked={form.deposit_required}
                onChange={e => setForm(f => ({ ...f, deposit_required: e.target.checked }))}
                className="accent-[#F4A523] w-4 h-4" />
              Require a deposit to book this job
            </label>
            {form.deposit_required && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="label">Type</label>
                  <select className="select" value={form.deposit_type} onChange={e => setForm(f => ({ ...f, deposit_type: e.target.value as 'fixed' | 'percent' }))}>
                    <option value="fixed">Fixed amount (£)</option>
                    <option value="percent">Percentage of total</option>
                  </select>
                </div>
                <div>
                  <label className="label">{form.deposit_type === 'percent' ? 'Percent (%)' : 'Amount (£)'}</label>
                  <NumberField className="input" value={form.deposit_value} onChange={n => setForm(f => ({ ...f, deposit_value: n }))} />
                </div>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Line Items</label>
              <div className="flex items-center gap-1">
                <button onClick={() => setForm(f => ({ ...f, items: [...f.items, { type: 'labour', description: 'Labour', quantity: 1, unit_price: labourRate }] }))} className="btn-ghost text-xs py-1 px-2 text-blue-400">+ Labour</button>
                <button onClick={() => setForm(f => ({ ...f, items: [...f.items, { type: 'part', description: '', quantity: 1, unit_price: 0 }] }))} className="btn-ghost text-xs py-1 px-2">+ Part / line</button>
              </div>
            </div>
            <div className="space-y-2">
              {form.items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-[90px_1fr_64px_92px_32px] gap-2">
                  <select className="select text-xs py-1.5" value={item.type} onChange={e => setItem(idx, { type: e.target.value as EditItem['type'] })}>
                    <option value="labour">Labour</option>
                    <option value="part">Part</option>
                    <option value="other">Other</option>
                  </select>
                  <input className="input text-xs py-1.5" value={item.description} placeholder="Description" onChange={e => setItem(idx, { description: e.target.value })} />
                  <NumberField className="input text-xs py-1.5" value={item.quantity} decimal={false} placeholder="Qty" onChange={n => setItem(idx, { quantity: n })} />
                  <NumberField className="input text-xs py-1.5" value={item.unit_price} placeholder="Price" onChange={n => setItem(idx, { unit_price: n })} />
                  <button onClick={() => setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))} className="btn-ghost p-1 text-red-400">×</button>
                </div>
              ))}
              {form.items.length === 0 && <p className="text-xs text-zinc-600">No items — add labour and parts above.</p>}
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t border-zinc-800 text-sm">
            <span className="text-zinc-500">Total (ex VAT): <span className="text-white font-bold text-base">{formatCurrency(formTotal)}</span></span>
          </div>
        </div>
      </Modal>
    </div>
  )
}

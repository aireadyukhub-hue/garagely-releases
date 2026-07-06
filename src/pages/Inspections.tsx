import { useEffect, useState } from 'react'
import { Plus, Search, Pencil, Trash2, Printer, ClipboardCheck, Camera, X as XIcon } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import NumberField from '@/components/ui/NumberField'
import NewCustomerButton from '@/components/NewCustomerButton'
import api from '@/lib/api'
import { Customer, Vehicle, Inspection, InspectionItem, InspectionStatus } from '@/types'
import { formatDate, cn, esc, printHtml } from '@/lib/utils'

// Standard UK vehicle health check template.
const TEMPLATE: { category: string; items: string[] }[] = [
  { category: 'Tyres', items: ['Front nearside', 'Front offside', 'Rear nearside', 'Rear offside', 'Spare / repair kit'] },
  { category: 'Brakes', items: ['Front pads / discs', 'Rear pads / discs / shoes', 'Handbrake', 'Brake fluid'] },
  { category: 'Lights & Electrics', items: ['Headlights', 'Brake lights', 'Indicators', 'Battery & charging'] },
  { category: 'Under Bonnet', items: ['Engine oil level', 'Coolant level', 'Drive belts', 'Hoses & leaks'] },
  { category: 'Steering & Suspension', items: ['Steering', 'Front suspension', 'Rear suspension', 'Wheel bearings'] },
  { category: 'Exhaust & Body', items: ['Exhaust system', 'Wipers & washers', 'Bodywork & corrosion'] },
]

const STATUS_META: Record<InspectionStatus, { label: string; dot: string; badge: string; report: string }> = {
  pass:     { label: 'Pass',     dot: 'bg-green-500',  badge: 'bg-green-500/15 text-green-400 border-green-500/30',   report: '#16a34a' },
  advisory: { label: 'Advisory', dot: 'bg-amber-500',  badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30',   report: '#d97706' },
  fail:     { label: 'Fail',     dot: 'bg-red-500',    badge: 'bg-red-500/15 text-red-400 border-red-500/30',         report: '#dc2626' },
  na:       { label: 'N/A',      dot: 'bg-zinc-600',   badge: 'bg-zinc-600/20 text-zinc-400 border-zinc-600/30',      report: '#9ca3af' },
}

const buildItems = (): InspectionItem[] =>
  TEMPLATE.flatMap(g => g.items.map(item => ({ category: g.category, item, status: 'pass' as InspectionStatus, note: '', photo: undefined })))

// Downscale a captured/chosen photo before storing it (keeps the inspection
// row small — these live inline in the items JSON, not separate file storage).
const readPhoto = (file: File, maxW = 640): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error)
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Could not read image'))
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width)
        const w = Math.round(img.width * scale)
        const h = Math.round(img.height * scale)
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', 0.72))
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })

const overallResult = (items: InspectionItem[]): 'pass' | 'advisory' | 'fail' => {
  if (items.some(i => i.status === 'fail')) return 'fail'
  if (items.some(i => i.status === 'advisory')) return 'advisory'
  return 'pass'
}

type Form = {
  id?: number
  customer_id: number
  vehicle_id: number
  mileage: number
  notes: string
  items: InspectionItem[]
}
const EMPTY: Form = { customer_id: 0, vehicle_id: 0, mileage: 0, notes: '', items: buildItems() }

export default function Inspections() {
  const [list, setList] = useState<Inspection[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [settings, setSettings] = useState<any>({})
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<Form>(EMPTY)
  const [saving, setSaving] = useState(false)

  const load = () => api.getInspections().then(d => { setList(d as Inspection[]); setLoading(false) })
  useEffect(() => {
    load()
    api.getCustomers().then(d => setCustomers(d as Customer[])).catch(() => {})
    api.getVehicles().then(d => setVehicles(d as Vehicle[])).catch(() => {})
    api.getSettings().then(s => setSettings(s || {})).catch(() => {})
  }, [])

  const customerVehicles = vehicles.filter(v => v.customer_id === form.customer_id)
  const filtered = list.filter(i =>
    `${i.registration || ''} ${i.make || ''} ${i.model || ''} ${i.first_name || ''} ${i.last_name || ''}`
      .toLowerCase().includes(search.toLowerCase())
  )

  const openNew = () => { setForm({ ...EMPTY, items: buildItems() }); setModalOpen(true) }
  const openEdit = (i: Inspection) => {
    setForm({
      id: i.id, customer_id: i.customer_id || 0, vehicle_id: i.vehicle_id || 0,
      mileage: Number(i.mileage) || 0, notes: i.notes || '',
      items: (i.items && i.items.length) ? i.items : buildItems(),
    })
    setModalOpen(true)
  }

  const setItemStatus = (idx: number, status: InspectionStatus) =>
    setForm(f => ({ ...f, items: f.items.map((it, n) => n === idx ? { ...it, status } : it) }))
  const setItemNote = (idx: number, note: string) =>
    setForm(f => ({ ...f, items: f.items.map((it, n) => n === idx ? { ...it, note } : it) }))
  const [photoBusy, setPhotoBusy] = useState<number | null>(null)
  const setItemPhoto = async (idx: number, file: File | null) => {
    if (!file) return
    setPhotoBusy(idx)
    try {
      const photo = await readPhoto(file)
      setForm(f => ({ ...f, items: f.items.map((it, n) => n === idx ? { ...it, photo } : it) }))
    } finally {
      setPhotoBusy(null)
    }
  }
  const removeItemPhoto = (idx: number) =>
    setForm(f => ({ ...f, items: f.items.map((it, n) => n === idx ? { ...it, photo: undefined } : it) }))

  const handleSave = async () => {
    if (!form.vehicle_id) { alert('Pick a vehicle for the inspection.'); return }
    setSaving(true)
    const payload = {
      customer_id: form.customer_id || null,
      vehicle_id: form.vehicle_id || null,
      mileage: form.mileage || null,
      notes: form.notes.trim(),
      items: form.items,
      result: overallResult(form.items),
      status: 'complete',
    }
    if (form.id) await api.updateInspection(form.id, payload)
    else await api.createInspection(payload)
    setModalOpen(false)
    setSaving(false)
    await load()
  }

  const handleDelete = async (i: Inspection) => {
    if (!confirm('Delete this inspection?')) return
    await api.deleteInspection(i.id)
    await load()
  }

  // Build & print a clean customer-facing report.
  const printReport = async (id: number) => {
    const { inspection, settings: s } = await api.getInspection(id) as { inspection: Inspection; settings: any }
    const items = inspection.items || []
    const res = inspection.result || overallResult(items)
    const resMeta = STATUS_META[(res || 'pass') as InspectionStatus]
    const cats = [...new Set(items.map(i => i.category))]
    const rows = cats.map(cat => {
      const inCat = items.filter(i => i.category === cat)
      const lines = inCat.map(i => {
        const m = STATUS_META[i.status]
        return `<tr>
          <td style="padding:6px 8px;border-bottom:1px solid #eee">${esc(i.item)}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #eee;color:${m.report};font-weight:600">${m.label}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #eee;color:#555">${esc(i.note || '')}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #eee">${i.photo ? `<img src="${i.photo}" style="height:48px;width:auto;border-radius:4px;object-fit:cover"/>` : ''}</td>
        </tr>`
      }).join('')
      return `<h3 style="margin:18px 0 4px;font-size:14px;color:#111">${esc(cat)}</h3>
        <table style="width:100%;border-collapse:collapse;font-size:13px"><tbody>${lines}</tbody></table>`
    }).join('')

    const logo = s?.logo_data ? `<img src="${s.logo_data}" style="max-height:54px;max-width:220px;object-fit:contain"/>` : `<div style="font-size:22px;font-weight:800;color:#111">${esc(s?.business_name || 'GarageDash')}</div>`
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Vehicle Health Check</title></head>
      <body style="font-family:Arial,Helvetica,sans-serif;color:#111;margin:24px;max-width:760px">
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #F4A523;padding-bottom:12px">
          <div>${logo}<div style="font-size:12px;color:#666;margin-top:4px">${esc(s?.address || '')}${s?.phone ? ' · ' + esc(s.phone) : ''}</div></div>
          <div style="text-align:right"><div style="font-size:18px;font-weight:700">Vehicle Health Check</div><div style="font-size:12px;color:#666">${formatDate(inspection.inspected_on || inspection.created_at)}</div></div>
        </div>
        <table style="width:100%;font-size:13px;margin:14px 0"><tr>
          <td><strong>Registration:</strong> ${esc(inspection.registration || '—')}</td>
          <td><strong>Vehicle:</strong> ${esc([inspection.make, inspection.model].filter(Boolean).join(' ') || '—')}</td>
          <td><strong>Mileage:</strong> ${inspection.mileage ? esc(inspection.mileage) + ' mi' : '—'}</td>
        </tr><tr>
          <td><strong>Customer:</strong> ${esc([inspection.first_name, inspection.last_name].filter(Boolean).join(' ') || '—')}</td>
        </tr></table>
        <div style="background:${resMeta.report};color:#fff;padding:10px 14px;border-radius:8px;font-weight:700;font-size:15px">
          Overall: ${resMeta.label}${res === 'fail' ? ' — items need attention' : res === 'advisory' ? ' — advisory items to monitor' : ' — no issues found'}
        </div>
        ${rows}
        ${inspection.notes ? `<h3 style="margin:18px 0 4px;font-size:14px">Notes</h3><p style="font-size:13px;color:#444">${esc(inspection.notes)}</p>` : ''}
        <p style="font-size:11px;color:#888;margin-top:24px;border-top:1px solid #eee;padding-top:10px">
          Green = no action · Amber = monitor / advisory · Red = attention required.
          ${esc(s?.jobsheet_footer || s?.invoice_footer || '')}
        </p>
      </body></html>`
    printHtml(html)
  }

  return (
    <div className="pt-2">
      <div className="page-header">
        <div>
          <h1 className="page-title">Inspections</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Digital vehicle health checks you can print or hand to the customer.</p>
        </div>
        <button onClick={openNew} className="btn-primary"><Plus className="w-4 h-4" /> New Inspection</button>
      </div>

      <div className="relative mb-5 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input className="input pl-9" placeholder="Search by reg or customer…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="text-zinc-500 text-sm py-10 text-center">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <div className="py-14 text-center text-zinc-500">
            <ClipboardCheck className="w-8 h-8 mx-auto mb-3 text-zinc-600" />
            <p className="text-sm">No inspections yet.</p>
            <p className="text-xs mt-1">Run a vehicle health check and give the customer a tidy report.</p>
            <button onClick={openNew} className="btn-secondary mt-4 mx-auto"><Plus className="w-4 h-4" /> New Inspection</button>
          </div>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                {['Vehicle', 'Customer', 'Date', 'Mileage', 'Result', ''].map((h, i) => (
                  <th key={i} className="text-left px-5 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(i => {
                const m = STATUS_META[(i.result || 'pass') as InspectionStatus]
                return (
                  <tr key={i.id} className="border-b border-zinc-800/50 last:border-0 hover:bg-zinc-800/20">
                    <td className="px-5 py-3.5">
                      <div className="font-mono text-xs text-blue-400">{i.registration || '—'}</div>
                      <div className="text-xs text-zinc-500">{[i.make, i.model].filter(Boolean).join(' ')}</div>
                    </td>
                    <td className="px-5 py-3.5 text-zinc-300">{[i.first_name, i.last_name].filter(Boolean).join(' ') || '—'}</td>
                    <td className="px-5 py-3.5 text-zinc-500 text-xs">{formatDate(i.inspected_on || i.created_at)}</td>
                    <td className="px-5 py-3.5 text-zinc-400 text-xs">{i.mileage ? `${i.mileage} mi` : '—'}</td>
                    <td className="px-5 py-3.5"><span className={cn('status-badge', m.badge)}>{m.label}</span></td>
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      <button onClick={() => printReport(i.id)} className="btn-ghost p-1.5" title="Print report"><Printer className="w-3.5 h-3.5" /></button>
                      <button onClick={() => openEdit(i)} className="btn-ghost p-1.5" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleDelete(i)} className="btn-ghost p-1.5 text-red-400 hover:text-red-300" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={form.id ? 'Edit Inspection' : 'New Inspection'} size="xl"
        footer={<>
          <button onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
          <button onClick={handleSave} disabled={saving || !form.vehicle_id} className="btn-primary">{saving ? 'Saving…' : 'Save inspection'}</button>
        </>}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <div className="flex items-center justify-between">
                <label className="label">Customer</label>
                <NewCustomerButton onCreated={c => { setCustomers(cs => [...cs, c]); setForm(f => ({ ...f, customer_id: c.id, vehicle_id: 0 })) }} />
              </div>
              <select className="select" value={form.customer_id || ''} onChange={e => setForm(f => ({ ...f, customer_id: Number(e.target.value), vehicle_id: 0 }))}>
                <option value="">Select…</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Vehicle *</label>
              <select className="select" value={form.vehicle_id || ''} onChange={e => setForm(f => ({ ...f, vehicle_id: Number(e.target.value) }))} disabled={!form.customer_id}>
                <option value="">Select…</option>
                {customerVehicles.map(v => <option key={v.id} value={v.id}>{v.registration} – {v.make} {v.model}</option>)}
              </select>
            </div>
            <div><label className="label">Mileage</label><NumberField className="input" value={form.mileage} decimal={false} onChange={n => setForm(f => ({ ...f, mileage: n }))} /></div>
          </div>

          <div className="space-y-3">
            {TEMPLATE.map(group => (
              <div key={group.category} className="border border-zinc-800 rounded-xl overflow-hidden">
                <div className="px-3 py-2 bg-zinc-800/40 text-xs font-semibold text-zinc-300 uppercase tracking-wide">{group.category}</div>
                <div className="divide-y divide-zinc-800/60">
                  {group.items.map(itemName => {
                    const idx = form.items.findIndex(it => it.category === group.category && it.item === itemName)
                    const it = form.items[idx]
                    if (!it) return null
                    return (
                      <div key={itemName} className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-zinc-200 flex-1 min-w-0">{itemName}</span>
                          <label className={cn('btn-ghost p-1.5 shrink-0 cursor-pointer', photoBusy === idx && 'opacity-50 pointer-events-none')} title="Add photo">
                            <Camera className="w-3.5 h-3.5" />
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              className="hidden"
                              onChange={(e) => { setItemPhoto(idx, e.target.files?.[0] || null); e.target.value = '' }}
                            />
                          </label>
                          <div className="flex gap-1 shrink-0">
                            {(['pass', 'advisory', 'fail', 'na'] as InspectionStatus[]).map(st => {
                              const m = STATUS_META[st]
                              const active = it.status === st
                              return (
                                <button key={st} type="button" onClick={() => setItemStatus(idx, st)}
                                  className={cn('w-8 h-7 rounded-md text-[11px] font-bold border transition-colors',
                                    active ? `${m.badge}` : 'border-zinc-700 text-zinc-500 hover:text-zinc-300')}>
                                  {st === 'pass' ? 'P' : st === 'advisory' ? 'A' : st === 'fail' ? 'F' : '–'}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                        {it.status !== 'pass' && it.status !== 'na' && (
                          <input className="input text-xs py-1 mt-1.5" placeholder="Note (what's wrong / recommendation)"
                            value={it.note || ''} onChange={e => setItemNote(idx, e.target.value)} />
                        )}
                        {it.photo && (
                          <div className="relative inline-block mt-1.5">
                            <img src={it.photo} alt={itemName} className="h-16 w-auto rounded-md border border-zinc-700 object-cover" />
                            <button type="button" onClick={() => removeItemPhoto(idx)}
                              className="absolute -top-1.5 -right-1.5 bg-zinc-900 border border-zinc-700 rounded-full p-0.5 text-zinc-400 hover:text-red-400">
                              <XIcon className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          <div><label className="label">Overall notes</label><textarea className="textarea" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Summary for the customer (optional)" /></div>

          <div className="flex items-center justify-between pt-2 border-t border-zinc-800 text-sm">
            <span className="text-zinc-500">Overall result</span>
            <span className={cn('status-badge', STATUS_META[overallResult(form.items)].badge)}>{STATUS_META[overallResult(form.items)].label}</span>
          </div>
        </div>
      </Modal>
    </div>
  )
}

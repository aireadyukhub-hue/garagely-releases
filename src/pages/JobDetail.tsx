import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Edit2, Trash2, Minus, FileText, Printer } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import api from '@/lib/api'
import { Job, LineItem } from '@/types'
import { formatDate, formatCurrency, printHtml, esc, JOB_STATUS_COLORS, JOB_STATUS_LABELS, cn } from '@/lib/utils'

const STATUSES = ['booked', 'in_progress', 'awaiting_parts', 'complete', 'invoiced'] as const

export default function JobDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [job, setJob] = useState<Job | null>(null)
  const [lineItems, setLineItems] = useState<LineItem[]>([])
  const [editOpen, setEditOpen] = useState(false)
  const [form, setForm] = useState<Partial<Job>>({})
  const [saving, setSaving] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editingLines, setEditingLines] = useState(false)
  const [draftLines, setDraftLines] = useState<LineItem[]>([])
  const [biz, setBiz] = useState<Record<string, string>>({})

  const load = () => api.getJob(Number(id)).then((d: unknown) => {
    const data = d as { job: Job; lineItems: LineItem[] }
    setJob(data.job)
    setLineItems(data.lineItems)
    setForm(data.job)
    setDraftLines(data.lineItems)
  })

  useEffect(() => { load() }, [id])
  useEffect(() => { api.getSettings().then(s => setBiz((s as Record<string, string>) || {})).catch(() => {}) }, [])

  const handleStatusChange = async (status: string) => {
    await api.updateJob(Number(id), { status })
    await load()
  }

  const handleSave = async () => {
    setSaving(true)
    await api.updateJob(Number(id), form)
    await load()
    setEditOpen(false)
    setSaving(false)
  }

  const handleSaveLines = async () => {
    setSaving(true)
    await api.saveJobLineItems(Number(id), draftLines)
    await load()
    setEditingLines(false)
    setSaving(false)
  }

  const handleDelete = async () => {
    await api.deleteJob(Number(id))
    navigate('/jobs')
  }

  const handleConvertInvoice = async () => {
    setSaving(true)
    const inv = (await api.convertJobToInvoice(Number(id))) as { id?: number } | undefined
    setSaving(false)
    if (inv?.id) navigate(`/invoices/${inv.id}`)
    else await load()
  }

  const handlePrint = () => {
    if (!job) return
    const rows = lineItems.map(li =>
      `<tr><td>${esc(li.description)}</td><td style="text-align:center">${li.quantity}</td><td class="r">${formatCurrency(li.unit_price)}</td><td class="r">${formatCurrency(li.total)}</td></tr>`).join('')
    const veh = [job.registration, job.make, job.model].filter(Boolean).join(' ')
    printHtml(`<!doctype html><html><head><meta charset="utf-8"><title>Job Sheet ${esc(job.job_number)}</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:34px;font-size:13px}
        h1{font-size:20px;margin:0}.r{text-align:right}.muted{color:#666;font-size:12px}
        table{width:100%;border-collapse:collapse;margin-top:14px}
        th,td{padding:7px 8px;border-bottom:1px solid #ddd;text-align:left}
        th{font-size:11px;text-transform:uppercase;color:#666;border-bottom:2px solid #333}
        tfoot td{border-bottom:none}
        .box{border:1px solid #ddd;border-radius:6px;padding:11px;margin-top:12px}
        .head{display:flex;justify-content:space-between;align-items:flex-start}
      </style></head><body>
      <div class="head">
        <div><h1>${esc(biz.business_name || 'Job Sheet')}</h1>
          <div class="muted">${esc(biz.address || '')}<br>${esc(biz.phone || '')} ${biz.email ? '· ' + esc(biz.email) : ''}</div></div>
        <div style="text-align:right">
          <div style="font-size:18px;font-weight:bold">JOB SHEET</div>
          <div class="muted">${esc(job.job_number)}</div>
          <div class="muted">${formatDate(job.booked_date)}</div></div>
      </div>
      <div class="box"><strong>${esc(job.title)}</strong><br>
        <span class="muted">${esc(job.first_name || '')} ${esc(job.last_name || '')}${veh ? ' · ' + esc(veh) : ''}</span></div>
      <table>
        <thead><tr><th>Description</th><th style="text-align:center">Qty</th><th class="r">Unit</th><th class="r">Total</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="4" class="muted">No line items</td></tr>'}</tbody>
        <tfoot>
          <tr><td colspan="3" class="r muted">Subtotal</td><td class="r">${formatCurrency(subtotal)}</td></tr>
          <tr><td colspan="3" class="r muted">VAT (20%)</td><td class="r">${formatCurrency(vat)}</td></tr>
          <tr><td colspan="3" class="r"><strong>Total</strong></td><td class="r"><strong>${formatCurrency(subtotal + vat)}</strong></td></tr>
        </tfoot>
      </table>
      ${job.technician_notes ? `<div class="box"><strong>Technician notes</strong><br>${esc(job.technician_notes).replace(/\n/g, '<br>')}</div>` : ''}
      ${job.description ? `<div class="box"><strong>Description</strong><br>${esc(job.description).replace(/\n/g, '<br>')}</div>` : ''}
      </body></html>`)
  }

  const addLine = (type: 'labour' | 'part') => {
    setDraftLines(l => [...l, { type, description: '', quantity: 1, unit_price: type === 'labour' ? (job?.labour_rate || 65) : 0, total: 0 }])
  }

  const updateLine = (idx: number, field: keyof LineItem, value: string | number) => {
    setDraftLines(lines => lines.map((l, i) => {
      if (i !== idx) return l
      const updated = { ...l, [field]: value }
      updated.total = Math.round(updated.quantity * updated.unit_price * 100) / 100
      return updated
    }))
  }

  const removeLine = (idx: number) => setDraftLines(l => l.filter((_, i) => i !== idx))

  const subtotal = lineItems.reduce((s, l) => s + l.total, 0)
  const vat = Math.round(subtotal * 0.2 * 100) / 100

  const F = (field: keyof Job) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [field]: field === 'labour_rate' ? Number(e.target.value) : e.target.value }))

  if (!job) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="pt-2">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/jobs')} className="btn-ghost p-2"><ArrowLeft className="w-4 h-4" /></button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="page-title">{job.title}</h1>
            <span className={cn('status-badge', JOB_STATUS_COLORS[job.status])}>{JOB_STATUS_LABELS[job.status]}</span>
          </div>
          <p className="text-sm text-zinc-500 mt-0.5 font-mono">{job.job_number}</p>
        </div>
        <button onClick={handlePrint} className="btn-secondary"><Printer className="w-4 h-4" /> Print</button>
        {job.status !== 'invoiced' && (
          <button onClick={handleConvertInvoice} disabled={saving} className="btn-secondary text-green-400 hover:text-green-300">
            <FileText className="w-4 h-4" /> {saving ? 'Creating…' : 'Create Invoice'}
          </button>
        )}
        <button onClick={() => setEditOpen(true)} className="btn-secondary"><Edit2 className="w-4 h-4" /> Edit</button>
        <button onClick={() => setDeleteOpen(true)} className="btn-danger"><Trash2 className="w-4 h-4" /></button>
      </div>

      <div className="grid grid-cols-3 gap-5 mb-5">
        {/* Job info */}
        <div className="card">
          <div className="card-header"><span className="text-sm font-medium text-zinc-300">Job Details</span></div>
          <div className="card-body space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-zinc-500">Customer</span>
              <Link to={`/customers/${job.customer_id}`} className="text-blue-400 hover:text-blue-300">{job.first_name} {job.last_name}</Link>
            </div>
            <div className="flex justify-between"><span className="text-zinc-500">Vehicle</span>
              <Link to={`/vehicles/${job.vehicle_id}`} className="font-mono text-xs text-zinc-300 hover:text-white">{job.registration} {job.make} {job.model}</Link>
            </div>
            <div className="flex justify-between"><span className="text-zinc-500">Assigned To</span><span className="text-zinc-200">{job.assigned_to || '—'}</span></div>
            <div className="flex justify-between"><span className="text-zinc-500">Labour Rate</span><span className="text-zinc-200">£{job.labour_rate}/hr</span></div>
            <div className="flex justify-between"><span className="text-zinc-500">Booked</span><span className="text-zinc-200">{formatDate(job.booked_date)}</span></div>
            {job.started_date && <div className="flex justify-between"><span className="text-zinc-500">Started</span><span className="text-zinc-200">{formatDate(job.started_date)}</span></div>}
            {job.completed_date && <div className="flex justify-between"><span className="text-zinc-500">Completed</span><span className="text-zinc-200">{formatDate(job.completed_date)}</span></div>}
          </div>
        </div>

        {/* Status workflow */}
        <div className="card">
          <div className="card-header"><span className="text-sm font-medium text-zinc-300">Status</span></div>
          <div className="card-body space-y-2">
            {STATUSES.map(s => (
              <button key={s} onClick={() => handleStatusChange(s)}
                className={cn('w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  job.status === s ? cn(JOB_STATUS_COLORS[s], 'border') : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'
                )}>
                {JOB_STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div className="card">
          <div className="card-header"><span className="text-sm font-medium text-zinc-300">Notes</span></div>
          <div className="card-body space-y-3 text-sm">
            {job.description && (
              <div>
                <p className="text-xs text-zinc-500 mb-1">Description</p>
                <p className="text-zinc-300">{job.description}</p>
              </div>
            )}
            {job.technician_notes && (
              <div>
                <p className="text-xs text-zinc-500 mb-1">Technician Notes</p>
                <p className="text-zinc-300">{job.technician_notes}</p>
              </div>
            )}
            {!job.description && !job.technician_notes && <p className="text-zinc-500">No notes</p>}
          </div>
        </div>
      </div>

      {/* Line items */}
      <div className="card mb-5">
        <div className="card-header flex items-center justify-between">
          <span className="text-sm font-medium text-zinc-300">Line Items</span>
          <div className="flex items-center gap-2">
            {editingLines ? (
              <>
                <button onClick={() => addLine('labour')} className="btn-ghost text-xs py-1.5 px-3">+ Labour</button>
                <button onClick={() => addLine('part')} className="btn-ghost text-xs py-1.5 px-3">+ Part</button>
                <button onClick={() => setEditingLines(false)} className="btn-secondary text-xs py-1.5 px-3">Cancel</button>
                <button onClick={handleSaveLines} disabled={saving} className="btn-primary text-xs py-1.5 px-3">{saving ? 'Saving…' : 'Save'}</button>
              </>
            ) : (
              <button onClick={() => { setDraftLines(lineItems); setEditingLines(true) }} className="btn-secondary text-xs py-1.5 px-3">
                <Edit2 className="w-3.5 h-3.5" /> Edit Lines
              </button>
            )}
          </div>
        </div>

        {editingLines ? (
          <div className="p-5 space-y-2">
            {draftLines.map((item, idx) => (
              <div key={idx} className="grid grid-cols-[100px_1fr_80px_100px_90px_36px] gap-2 items-center">
                <select className="select text-xs py-1.5" value={item.type} onChange={e => updateLine(idx, 'type', e.target.value)}>
                  <option value="labour">Labour</option>
                  <option value="part">Part</option>
                  <option value="other">Other</option>
                </select>
                <input className="input text-xs py-1.5" value={item.description} onChange={e => updateLine(idx, 'description', e.target.value)} placeholder="Description" />
                <input type="number" className="input text-xs py-1.5 text-center" value={item.quantity} step="0.5" onChange={e => updateLine(idx, 'quantity', Number(e.target.value))} placeholder="Qty" />
                <input type="number" className="input text-xs py-1.5" value={item.unit_price} step="0.01" onChange={e => updateLine(idx, 'unit_price', Number(e.target.value))} placeholder="Unit price" />
                <span className="text-sm font-medium text-zinc-200 text-right">{formatCurrency(item.total)}</span>
                <button onClick={() => removeLine(idx)} className="btn-ghost p-1 text-red-400 hover:text-red-300">
                  <Minus className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {draftLines.length === 0 && <p className="text-sm text-zinc-500">No line items. Add labour or parts above.</p>}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left px-5 py-2.5 text-xs text-zinc-500 font-medium uppercase">Type</th>
                <th className="text-left px-5 py-2.5 text-xs text-zinc-500 font-medium uppercase">Description</th>
                <th className="text-right px-5 py-2.5 text-xs text-zinc-500 font-medium uppercase">Qty</th>
                <th className="text-right px-5 py-2.5 text-xs text-zinc-500 font-medium uppercase">Unit</th>
                <th className="text-right px-5 py-2.5 text-xs text-zinc-500 font-medium uppercase">Total</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-zinc-500">No line items yet</td></tr>
              ) : lineItems.map(item => (
                <tr key={item.id} className="border-b border-zinc-800/50 last:border-0">
                  <td className="px-5 py-3">
                    <span className="capitalize text-xs text-zinc-400">{item.type}</span>
                  </td>
                  <td className="px-5 py-3 text-zinc-200">{item.description}</td>
                  <td className="px-5 py-3 text-right text-zinc-400">{item.quantity}</td>
                  <td className="px-5 py-3 text-right text-zinc-400">{formatCurrency(item.unit_price)}</td>
                  <td className="px-5 py-3 text-right font-medium text-zinc-200">{formatCurrency(item.total)}</td>
                </tr>
              ))}
            </tbody>
            {lineItems.length > 0 && (
              <tfoot>
                <tr className="border-t border-zinc-700">
                  <td colSpan={4} className="px-5 py-3 text-right text-xs text-zinc-500">Subtotal</td>
                  <td className="px-5 py-3 text-right font-medium text-zinc-200">{formatCurrency(subtotal)}</td>
                </tr>
                <tr>
                  <td colSpan={4} className="px-5 py-1.5 text-right text-xs text-zinc-500">VAT (20%)</td>
                  <td className="px-5 py-1.5 text-right text-zinc-400">{formatCurrency(vat)}</td>
                </tr>
                <tr className="bg-zinc-800/30">
                  <td colSpan={4} className="px-5 py-3 text-right text-sm font-semibold text-zinc-200">Total</td>
                  <td className="px-5 py-3 text-right text-base font-bold text-white">{formatCurrency(subtotal + vat)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        )}
      </div>

      {/* Edit modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Job" size="lg"
        footer={
          <>
            <button onClick={() => setEditOpen(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save'}</button>
          </>
        }
      >
        <div className="space-y-4">
          <div><label className="label">Title</label><input className="input" value={form.title || ''} onChange={F('title')} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Status</label>
              <select className="select" value={form.status} onChange={F('status')}>
                {Object.entries(JOB_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div><label className="label">Assigned To</label><input className="input" value={form.assigned_to || ''} onChange={F('assigned_to')} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="label">Booked Date</label><input type="date" className="input" value={form.booked_date || ''} onChange={F('booked_date')} /></div>
            <div><label className="label">Started Date</label><input type="date" className="input" value={form.started_date || ''} onChange={F('started_date')} /></div>
            <div><label className="label">Completed Date</label><input type="date" className="input" value={form.completed_date || ''} onChange={F('completed_date')} /></div>
          </div>
          <div><label className="label">Labour Rate (£/hr)</label><input type="number" className="input" value={form.labour_rate || 65} onChange={F('labour_rate')} /></div>
          <div><label className="label">Description</label><textarea className="textarea" rows={3} value={form.description || ''} onChange={F('description')} /></div>
          <div><label className="label">Technician Notes</label><textarea className="textarea" rows={3} value={form.technician_notes || ''} onChange={F('technician_notes')} /></div>
        </div>
      </Modal>

      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete Job"
        footer={
          <>
            <button onClick={() => setDeleteOpen(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleDelete} className="btn-danger">Delete Job</button>
          </>
        }
      >
        <p className="text-zinc-300">Delete job <strong className="font-mono">{job.job_number}</strong>? This cannot be undone.</p>
      </Modal>
    </div>
  )
}

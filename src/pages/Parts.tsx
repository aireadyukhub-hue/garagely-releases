import { useEffect, useState } from 'react'
import { Plus, Search, AlertTriangle, Edit2, Trash2 } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import NumberField from '@/components/ui/NumberField'
import api from '@/lib/api'
import { Part } from '@/types'
import { formatCurrency, cn } from '@/lib/utils'

const EMPTY_P: Partial<Part> = { sku: '', name: '', description: '', supplier: '', cost_price: 0, sale_price: 0, stock_quantity: 0, min_stock: 2, location: '' }

export default function Parts() {
  const [parts, setParts] = useState<Part[]>([])
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editPart, setEditPart] = useState<Part | null>(null)
  const [form, setForm] = useState<Partial<Part>>(EMPTY_P)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const load = () => api.getParts().then(d => setParts(d as Part[]))
  useEffect(() => { load() }, [])

  const filtered = parts.filter(p =>
    `${p.name} ${p.sku} ${p.supplier} ${p.description}`.toLowerCase().includes(search.toLowerCase())
  )

  const lowStock = parts.filter(p => p.stock_quantity <= p.min_stock)

  const handleSave = async () => {
    setSaving(true)
    if (editPart) {
      await api.updatePart(editPart.id, form)
    } else {
      await api.createPart(form)
    }
    setModalOpen(false)
    setEditPart(null)
    setForm(EMPTY_P)
    await load()
    setSaving(false)
  }

  const handleDelete = async () => {
    if (!deleteId) return
    await api.deletePart(deleteId)
    setDeleteId(null)
    await load()
  }

  const openEdit = (p: Part) => { setEditPart(p); setForm(p); setModalOpen(true) }
  const openNew = () => { setEditPart(null); setForm(EMPTY_P); setModalOpen(true) }

  const F = (field: keyof Part) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [field]: ['cost_price', 'sale_price', 'stock_quantity', 'min_stock'].includes(field) ? Number(e.target.value) : e.target.value }))

  const margin = (p: Part) => p.cost_price > 0 ? ((p.sale_price - p.cost_price) / p.cost_price * 100).toFixed(0) + '%' : '—'

  return (
    <div className="pt-2">
      <div className="page-header">
        <h1 className="page-title">Parts & Inventory</h1>
        <button onClick={openNew} className="btn-primary"><Plus className="w-4 h-4" /> Add Part</button>
      </div>

      {/* Low stock alert */}
      {lowStock.length > 0 && (
        <div className="alert-banner bg-amber-500/10 border-amber-500/30 text-amber-300 mb-5">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium">Low Stock Alert</p>
            <p className="text-xs mt-0.5">{lowStock.map(p => `${p.name} (${p.stock_quantity} left)`).join(', ')}</p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        {[
          { label: 'Total Parts', value: parts.length.toString() },
          { label: 'Low Stock', value: lowStock.length.toString(), alert: lowStock.length > 0 },
          { label: 'Stock Value (Cost)', value: formatCurrency(parts.reduce((s, p) => s + p.cost_price * p.stock_quantity, 0)) },
          { label: 'Stock Value (Sale)', value: formatCurrency(parts.reduce((s, p) => s + p.sale_price * p.stock_quantity, 0)) },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <span className="text-xs text-zinc-500 uppercase tracking-wide font-medium">{s.label}</span>
            <span className={cn('text-2xl font-semibold', s.alert ? 'text-amber-400' : 'text-white')}>{s.value}</span>
          </div>
        ))}
      </div>

      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input className="input pl-9" placeholder="Search parts…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-zinc-800">
              {['SKU', 'Name', 'Supplier', 'Stock', 'Cost', 'Sale', 'Margin', 'Actions'].map(h => (
                <th key={h} className="text-left px-5 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={8} className="px-5 py-10 text-center text-zinc-500">No parts found</td></tr>
            ) : filtered.map(p => (
              <tr key={p.id} className="border-b border-zinc-800/50 last:border-0 hover:bg-zinc-800/20 transition-colors">
                <td className="px-5 py-3.5 font-mono text-xs text-zinc-400">{p.sku || '—'}</td>
                <td className="px-5 py-3.5">
                  <div className="text-zinc-200 font-medium">{p.name}</div>
                  {p.description && <div className="text-xs text-zinc-500">{p.description}</div>}
                </td>
                <td className="px-5 py-3.5 text-zinc-400">{p.supplier || '—'}</td>
                <td className="px-5 py-3.5">
                  <span className={cn('font-semibold', p.stock_quantity <= p.min_stock ? 'text-amber-400' : 'text-zinc-200')}>
                    {p.stock_quantity}
                  </span>
                  <span className="text-xs text-zinc-600 ml-1">/ min {p.min_stock}</span>
                </td>
                <td className="px-5 py-3.5 text-zinc-400">{formatCurrency(p.cost_price)}</td>
                <td className="px-5 py-3.5 text-zinc-200 font-medium">{formatCurrency(p.sale_price)}</td>
                <td className="px-5 py-3.5 text-green-400 text-xs font-medium">{margin(p)}</td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEdit(p)} className="btn-ghost p-1.5"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setDeleteId(p.id)} className="btn-ghost p-1.5 text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editPart ? 'Edit Part' : 'Add Part'} size="lg"
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleSave} disabled={saving || !form.name} className="btn-primary">{saving ? 'Saving…' : 'Save'}</button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="label">Name *</label><input className="input" value={form.name} onChange={F('name')} /></div>
            <div><label className="label">SKU</label><input className="input font-mono" value={form.sku} onChange={F('sku')} /></div>
          </div>
          <div><label className="label">Description</label><input className="input" value={form.description} onChange={F('description')} /></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="label">Supplier</label><input className="input" value={form.supplier} onChange={F('supplier')} /></div>
            <div><label className="label">Location</label><input className="input" value={form.location} onChange={F('location')} /></div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div><label className="label">Cost Price</label><NumberField className="input" value={form.cost_price} onChange={n => setForm(f => ({ ...f, cost_price: n }))} /></div>
            <div><label className="label">Sale Price</label><NumberField className="input" value={form.sale_price} onChange={n => setForm(f => ({ ...f, sale_price: n }))} /></div>
            <div><label className="label">Stock Qty</label><NumberField className="input" value={form.stock_quantity} decimal={false} onChange={n => setForm(f => ({ ...f, stock_quantity: n }))} /></div>
            <div><label className="label">Min Stock</label><NumberField className="input" value={form.min_stock} decimal={false} onChange={n => setForm(f => ({ ...f, min_stock: n }))} /></div>
          </div>
        </div>
      </Modal>

      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Part"
        footer={
          <>
            <button onClick={() => setDeleteId(null)} className="btn-secondary">Cancel</button>
            <button onClick={handleDelete} className="btn-danger">Delete</button>
          </>
        }
      >
        <p className="text-zinc-300">Delete this part? This cannot be undone.</p>
      </Modal>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { Plus, Search, Edit2, Trash2, Globe } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import CallButton from '@/components/CallButton'
import api from '@/lib/api'

interface Supplier {
  id: number; name: string; contact_name?: string; phone?: string; email?: string
  website?: string; address?: string; account_number?: string; notes?: string
}
const EMPTY = { name: '', contact_name: '', phone: '', email: '', website: '', address: '', account_number: '', notes: '' }

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [form, setForm] = useState<Record<string, string | number | undefined>>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const load = () => api.getSuppliers().then(d => setSuppliers(d as Supplier[]))
  useEffect(() => { load() }, [])

  const filtered = suppliers.filter(s =>
    `${s.name} ${s.contact_name || ''} ${s.phone || ''} ${s.email || ''}`.toLowerCase().includes(search.toLowerCase()))

  const openNew = () => { setEditing(null); setForm(EMPTY); setModalOpen(true) }
  const openEdit = (s: Supplier) => { setEditing(s); setForm({ ...EMPTY, ...s }); setModalOpen(true) }
  const F = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }))

  const handleSave = async () => {
    setSaving(true)
    if (editing) await api.updateSupplier(editing.id, form)
    else await api.createSupplier(form)
    setModalOpen(false); await load(); setSaving(false)
  }
  const handleDelete = async () => { if (deleteId) await api.deleteSupplier(deleteId); setDeleteId(null); await load() }

  return (
    <div className="pt-2">
      <div className="page-header">
        <h1 className="page-title">Suppliers</h1>
        <button onClick={openNew} className="btn-primary"><Plus className="w-4 h-4" /> New Supplier</button>
      </div>

      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input className="input pl-9" placeholder="Search suppliers…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800">
              {['Supplier', 'Contact', 'Phone', 'Email', 'Account #', ''].map((h, i) => (
                <th key={i} className="text-left px-5 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-5 py-10 text-center text-zinc-500">No suppliers yet</td></tr>
            ) : filtered.map(s => (
              <tr key={s.id} className="border-b border-zinc-800/50 last:border-0 hover:bg-zinc-800/20">
                <td className="px-5 py-3.5">
                  <div className="font-medium text-zinc-200">{s.name}</div>
                  {s.website && (
                    <button onClick={() => window.open(s.website!.startsWith('http') ? s.website! : `https://${s.website}`)}
                      className="text-xs text-blue-400 hover:text-blue-300 inline-flex items-center gap-1 mt-0.5">
                      <Globe className="w-3 h-3" /> {s.website}
                    </button>
                  )}
                </td>
                <td className="px-5 py-3.5 text-zinc-300">{s.contact_name || '—'}</td>
                <td className="px-5 py-3.5">
                  {s.phone ? (
                    <span className="flex items-center gap-1.5 text-zinc-300">{s.phone}<CallButton number={s.phone} /></span>
                  ) : <span className="text-zinc-500">—</span>}
                </td>
                <td className="px-5 py-3.5">
                  {s.email ? <a href={`mailto:${s.email}`} className="text-blue-400 hover:text-blue-300">{s.email}</a> : <span className="text-zinc-500">—</span>}
                </td>
                <td className="px-5 py-3.5 font-mono text-xs text-zinc-400">{s.account_number || '—'}</td>
                <td className="px-5 py-3.5 text-right whitespace-nowrap">
                  <button onClick={() => openEdit(s)} className="btn-ghost p-1.5"><Edit2 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => setDeleteId(s.id)} className="btn-ghost p-1.5 text-red-400 hover:text-red-300"><Trash2 className="w-3.5 h-3.5" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Supplier' : 'New Supplier'} size="lg"
        footer={<>
          <button onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
          <button onClick={handleSave} disabled={saving || !form.name} className="btn-primary">{saving ? 'Saving…' : 'Save'}</button>
        </>}>
        <div className="space-y-4">
          <div><label className="label">Supplier Name *</label><input className="input" value={form.name} onChange={F('name')} placeholder="e.g. Euro Car Parts" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Contact Name</label><input className="input" value={form.contact_name} onChange={F('contact_name')} /></div>
            <div><label className="label">Account Number</label><input className="input font-mono" value={form.account_number} onChange={F('account_number')} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Phone</label><input className="input" value={form.phone} onChange={F('phone')} /></div>
            <div><label className="label">Email</label><input type="email" className="input" value={form.email} onChange={F('email')} /></div>
          </div>
          <div><label className="label">Website</label><input className="input" value={form.website} onChange={F('website')} placeholder="eurocarparts.com" /></div>
          <div><label className="label">Address</label><input className="input" value={form.address} onChange={F('address')} /></div>
          <div><label className="label">Notes</label><textarea className="textarea" rows={2} value={form.notes} onChange={F('notes')} /></div>
        </div>
      </Modal>

      <Modal open={deleteId !== null} onClose={() => setDeleteId(null)} title="Delete Supplier"
        footer={<>
          <button onClick={() => setDeleteId(null)} className="btn-secondary">Cancel</button>
          <button onClick={handleDelete} className="btn-danger">Delete</button>
        </>}>
        <p className="text-zinc-300">Delete this supplier? This cannot be undone.</p>
      </Modal>
    </div>
  )
}

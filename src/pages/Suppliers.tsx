import { useEffect, useState } from 'react'
import { Plus, Search, Edit2, Trash2, Globe, MapPin, Loader2 } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import CallButton from '@/components/CallButton'
import api from '@/lib/api'

interface Supplier {
  id: number; name: string; contact_name?: string; phone?: string; email?: string
  website?: string; address?: string; account_number?: string; notes?: string
}
type LocalResult = { name: string; address: string; phone: string; website: string; distance: number | null }
const EMPTY = { name: '', contact_name: '', phone: '', email: '', website: '', address: '', account_number: '', notes: '' }

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [form, setForm] = useState<Record<string, string | number | undefined>>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  // Local supplier search (Google Places via the Worker)
  const [findOpen, setFindOpen] = useState(false)
  const [postcode, setPostcode] = useState('')
  const [radius, setRadius] = useState(10)
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<LocalResult[]>([])
  const [searchErr, setSearchErr] = useState('')
  const [picked, setPicked] = useState<number[]>([])
  const [adding, setAdding] = useState(false)
  const [searched, setSearched] = useState(false)

  const load = () => api.getSuppliers().then(d => setSuppliers(d as Supplier[]))
  useEffect(() => { load() }, [])

  const openFind = () => { setFindOpen(true); setResults([]); setPicked([]); setSearchErr(''); setSearched(false) }

  const runLocalSearch = async () => {
    if (!postcode.trim()) return
    setSearching(true); setSearchErr(''); setResults([]); setPicked([]); setSearched(false)
    try {
      const r = await api.searchLocalSuppliers(postcode.trim(), radius)
      setResults(r.suppliers || [])
      if (r.error) setSearchErr(r.error)
      setSearched(true)
    } catch (e) {
      setSearchErr((e as Error).message || 'Search failed')
    } finally {
      setSearching(false)
    }
  }

  const addPicked = async () => {
    setAdding(true)
    try {
      const existing = new Set(suppliers.map(s => s.name.toLowerCase()))
      for (const i of picked) {
        const r = results[i]
        if (!r || existing.has(r.name.toLowerCase())) continue
        await api.createSupplier({ name: r.name, phone: r.phone, website: r.website, address: r.address })
      }
      setFindOpen(false)
      await load()
    } finally {
      setAdding(false)
    }
  }

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
        <div className="flex items-center gap-2">
          <button onClick={openFind} className="btn-secondary"><MapPin className="w-4 h-4" /> Search local</button>
          <button onClick={openNew} className="btn-primary"><Plus className="w-4 h-4" /> New Supplier</button>
        </div>
      </div>

      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input className="input pl-9" placeholder="Search suppliers…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="label">Contact Name</label><input className="input" value={form.contact_name} onChange={F('contact_name')} /></div>
            <div><label className="label">Account Number</label><input className="input font-mono" value={form.account_number} onChange={F('account_number')} /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="label">Phone</label><input className="input" value={form.phone} onChange={F('phone')} /></div>
            <div><label className="label">Email</label><input type="email" className="input" value={form.email} onChange={F('email')} /></div>
          </div>
          <div><label className="label">Website</label><input className="input" value={form.website} onChange={F('website')} placeholder="eurocarparts.com" /></div>
          <div><label className="label">Address</label><input className="input" value={form.address} onChange={F('address')} /></div>
          <div><label className="label">Notes</label><textarea className="textarea" rows={2} value={form.notes} onChange={F('notes')} /></div>
        </div>
      </Modal>

      {/* Search local motor factors */}
      <Modal open={findOpen} onClose={() => setFindOpen(false)} title="Search local suppliers" size="lg"
        footer={<>
          <button onClick={() => setFindOpen(false)} className="btn-secondary">Close</button>
          <button onClick={addPicked} disabled={adding || picked.length === 0} className="btn-primary">
            {adding ? 'Adding…' : `Add ${picked.length || ''} to suppliers`}
          </button>
        </>}>
        <div className="space-y-4">
          <p className="text-xs text-zinc-500">Find motor factors / car-parts shops near a postcode, then tick the ones you want to add.</p>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="label">Postcode</label>
              <input className="input" value={postcode} onChange={e => setPostcode(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') runLocalSearch() }} placeholder="e.g. ST4 2AB" />
            </div>
            <div className="w-28">
              <label className="label">Within</label>
              <select className="select" value={radius} onChange={e => setRadius(Number(e.target.value))}>
                {[5, 10, 15, 20, 30].map(r => <option key={r} value={r}>{r} miles</option>)}
              </select>
            </div>
            <button onClick={runLocalSearch} disabled={searching || !postcode.trim()} className="btn-primary">
              {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Search
            </button>
          </div>

          {searchErr && <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{searchErr}</div>}

          {searched && results.length === 0 && !searchErr && (
            <div className="text-sm text-zinc-500 text-center py-6">No motor factors found near that postcode. Try a wider radius.</div>
          )}

          {results.length > 0 && (
            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {results.map((r, i) => {
                const isPicked = picked.includes(i)
                const dupe = suppliers.some(s => s.name.toLowerCase() === r.name.toLowerCase())
                return (
                  <label key={i} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${isPicked ? 'border-[#F4A523]/60 bg-[#F4A523]/10' : 'border-zinc-700 hover:border-zinc-600'}`}>
                    <input type="checkbox" checked={isPicked} disabled={dupe} className="accent-[#F4A523] w-4 h-4 mt-0.5"
                      onChange={e => setPicked(p => e.target.checked ? [...p, i] : p.filter(x => x !== i))} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-zinc-100">{r.name}{dupe && <span className="text-[11px] text-zinc-500 ml-2">already added</span>}</span>
                        {r.distance != null && <span className="text-xs text-zinc-500 shrink-0">{r.distance} mi</span>}
                      </div>
                      {r.address && <div className="text-xs text-zinc-500 mt-0.5">{r.address}</div>}
                      <div className="text-xs text-zinc-500 mt-0.5 flex flex-wrap gap-x-3">
                        {r.phone && <span>{r.phone}</span>}
                        {r.website && <span className="text-blue-400 truncate max-w-[220px]">{r.website.replace(/^https?:\/\//, '')}</span>}
                      </div>
                    </div>
                  </label>
                )
              })}
            </div>
          )}
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

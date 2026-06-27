import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, Users, Phone, Mail } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import CallButton from '@/components/CallButton'
import api from '@/lib/api'
import { Customer } from '@/types'
import { formatDate } from '@/lib/utils'

const EMPTY: Partial<Customer> = { first_name: '', last_name: '', email: '', phone: '', mobile: '', address: '', city: '', postcode: '', notes: '' }

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<Partial<Customer>>(EMPTY)
  const [saving, setSaving] = useState(false)

  const load = () => api.getCustomers().then(d => setCustomers(d as Customer[]))
  useEffect(() => { load() }, [])

  const filtered = customers.filter(c =>
    `${c.first_name} ${c.last_name} ${c.email} ${c.phone} ${c.mobile} ${c.postcode}`
      .toLowerCase().includes(search.toLowerCase())
  )

  const handleSave = async () => {
    setSaving(true)
    await api.createCustomer(form)
    setModalOpen(false)
    setForm(EMPTY)
    await load()
    setSaving(false)
  }

  const F = (field: keyof Customer) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [field]: e.target.value }))

  return (
    <div className="pt-2">
      <div className="page-header">
        <h1 className="page-title">Customers</h1>
        <button onClick={() => { setForm(EMPTY); setModalOpen(true) }} className="btn-primary">
          <Plus className="w-4 h-4" /> New Customer
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input
          className="input pl-9"
          placeholder="Search customers…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="text-left px-5 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wide">Name</th>
              <th className="text-left px-5 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wide">Contact</th>
              <th className="text-left px-5 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wide">Location</th>
              <th className="text-left px-5 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wide">Vehicles</th>
              <th className="text-left px-5 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wide">Jobs</th>
              <th className="text-left px-5 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wide">Since</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-5 py-10 text-center text-zinc-500">
                {search ? 'No customers match your search' : 'No customers yet'}
              </td></tr>
            ) : filtered.map(c => (
              <tr key={c.id} className="table-row-hover border-b border-zinc-800/50 last:border-0">
                <td className="px-5 py-3.5">
                  <Link to={`/customers/${c.id}`} className="font-medium text-zinc-200 hover:text-white">
                    {c.first_name} {c.last_name}
                  </Link>
                </td>
                <td className="px-5 py-3.5">
                  <div className="space-y-0.5">
                    {c.email && <div className="flex items-center gap-1.5 text-zinc-400 text-xs"><Mail className="w-3 h-3" />{c.email}</div>}
                    {(c.phone || c.mobile) && <div className="flex items-center gap-1.5 text-zinc-400 text-xs"><Phone className="w-3 h-3" />{c.phone || c.mobile}<CallButton number={c.phone || c.mobile} /></div>}
                  </div>
                </td>
                <td className="px-5 py-3.5 text-zinc-400">{[c.city, c.postcode].filter(Boolean).join(', ') || '—'}</td>
                <td className="px-5 py-3.5">
                  <span className="inline-flex items-center gap-1.5 text-zinc-400">
                    <Users className="w-3.5 h-3.5" /> {c.vehicle_count ?? 0}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-zinc-400">{c.job_count ?? 0}</td>
                <td className="px-5 py-3.5 text-zinc-500 text-xs">{formatDate(c.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* New customer modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="New Customer"
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleSave} disabled={saving || !form.first_name || !form.last_name} className="btn-primary">
              {saving ? 'Saving…' : 'Save Customer'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="label">First Name *</label><input className="input" value={form.first_name} onChange={F('first_name')} /></div>
            <div><label className="label">Last Name *</label><input className="input" value={form.last_name} onChange={F('last_name')} /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="label">Email</label><input type="email" className="input" value={form.email} onChange={F('email')} /></div>
            <div><label className="label">Phone</label><input className="input" value={form.phone} onChange={F('phone')} /></div>
          </div>
          <div><label className="label">Mobile</label><input className="input" value={form.mobile} onChange={F('mobile')} /></div>
          <div><label className="label">Address</label><input className="input" value={form.address} onChange={F('address')} /></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="label">City</label><input className="input" value={form.city} onChange={F('city')} /></div>
            <div><label className="label">Postcode</label><input className="input" value={form.postcode} onChange={F('postcode')} /></div>
          </div>
          <div><label className="label">Notes</label><textarea className="textarea" rows={3} value={form.notes} onChange={F('notes')} /></div>
        </div>
      </Modal>
    </div>
  )
}

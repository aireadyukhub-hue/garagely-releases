import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Plus, Search, Filter } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import api from '@/lib/api'
import { Job, Customer, Vehicle } from '@/types'
import { formatDate, formatCurrency, JOB_STATUS_COLORS, JOB_STATUS_LABELS, cn } from '@/lib/utils'

const STATUSES = ['all', 'booked', 'in_progress', 'awaiting_parts', 'complete', 'invoiced']
const EMPTY_J = { customer_id: 0, vehicle_id: 0, status: 'booked', title: '', description: '', assigned_to: '', labour_rate: 65, booked_date: '' }

export default function Jobs() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<Partial<Job>>(EMPTY_J)
  const [saving, setSaving] = useState(false)
  const [searchParams] = useSearchParams()

  useEffect(() => {
    const s = searchParams.get('status')
    if (s) setStatusFilter(s)
  }, [searchParams])

  const load = (filters?: { status?: string; search?: string }) =>
    api.getJobs(filters).then(d => setJobs(d as Job[]))

  useEffect(() => {
    load()
    api.getCustomers().then(d => setCustomers(d as Customer[]))
  }, [])

  useEffect(() => {
    if (form.customer_id) {
      api.getVehicles(form.customer_id).then(d => setVehicles(d as Vehicle[]))
    }
  }, [form.customer_id])

  const filtered = jobs.filter(j => {
    const matchStatus = statusFilter === 'all' || j.status === statusFilter
    const matchSearch = `${j.title} ${j.job_number} ${j.first_name} ${j.last_name} ${j.registration}`
      .toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchSearch
  })

  const handleSave = async () => {
    setSaving(true)
    await api.createJob(form)
    setModalOpen(false)
    setForm(EMPTY_J)
    await load()
    setSaving(false)
  }

  const F = (field: keyof Job) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [field]: field === 'customer_id' || field === 'vehicle_id' || field === 'labour_rate' ? Number(e.target.value) : e.target.value }))

  const customerVehicles = vehicles.filter(v => v.customer_id === form.customer_id)

  return (
    <div className="pt-2">
      <div className="page-header">
        <h1 className="page-title">Job Sheets</h1>
        <button onClick={() => { setForm(EMPTY_J); setModalOpen(true) }} className="btn-primary">
          <Plus className="w-4 h-4" /> New Job
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input className="input pl-9" placeholder="Search jobs…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-1">
          {STATUSES.map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={cn('px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize',
                statusFilter === s ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
              )}>
              {s === 'all' ? 'All' : JOB_STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800">
              {['Job #', 'Title', 'Customer', 'Vehicle', 'Status', 'Assigned', 'Value', 'Date'].map(h => (
                <th key={h} className="text-left px-5 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={8} className="px-5 py-10 text-center text-zinc-500">No jobs found</td></tr>
            ) : filtered.map(j => (
              <tr key={j.id} className="table-row-hover border-b border-zinc-800/50 last:border-0">
                <td className="px-5 py-3.5">
                  <Link to={`/jobs/${j.id}`} className="font-mono text-blue-400 hover:text-blue-300 text-xs">{j.job_number}</Link>
                </td>
                <td className="px-5 py-3.5 text-zinc-200 max-w-[200px] truncate">{j.title}</td>
                <td className="px-5 py-3.5">
                  <Link to={`/customers/${j.customer_id}`} className="text-zinc-300 hover:text-white">{j.first_name} {j.last_name}</Link>
                </td>
                <td className="px-5 py-3.5">
                  <Link to={`/vehicles/${j.vehicle_id}`} className="font-mono text-xs text-zinc-400 hover:text-zinc-200">{j.registration}</Link>
                </td>
                <td className="px-5 py-3.5">
                  <span className={cn('status-badge', JOB_STATUS_COLORS[j.status])}>{JOB_STATUS_LABELS[j.status]}</span>
                </td>
                <td className="px-5 py-3.5 text-zinc-400">{j.assigned_to || '—'}</td>
                <td className="px-5 py-3.5 text-zinc-300 font-medium">{j.total_value ? formatCurrency(j.total_value) : '—'}</td>
                <td className="px-5 py-3.5 text-zinc-500 text-xs">{formatDate(j.booked_date)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* New job modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Job" size="lg"
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleSave} disabled={saving || !form.title || !form.customer_id || !form.vehicle_id} className="btn-primary">
              {saving ? 'Saving…' : 'Create Job'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div><label className="label">Job Title *</label><input className="input" value={form.title} onChange={F('title')} placeholder="e.g. Full Service" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Customer *</label>
              <select className="select" value={form.customer_id || ''} onChange={F('customer_id')}>
                <option value="">Select…</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Vehicle *</label>
              <select className="select" value={form.vehicle_id || ''} onChange={F('vehicle_id')} disabled={!form.customer_id}>
                <option value="">Select…</option>
                {customerVehicles.map(v => <option key={v.id} value={v.id}>{v.registration} – {v.make} {v.model}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Status</label>
              <select className="select" value={form.status} onChange={F('status')}>
                {Object.entries(JOB_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div><label className="label">Booked Date</label><input type="date" className="input" value={form.booked_date} onChange={F('booked_date')} /></div>
            <div><label className="label">Assigned To</label><input className="input" value={form.assigned_to} onChange={F('assigned_to')} /></div>
          </div>
          <div><label className="label">Labour Rate (£/hr)</label><input type="number" className="input" value={form.labour_rate} onChange={F('labour_rate')} /></div>
          <div><label className="label">Description</label><textarea className="textarea" rows={3} value={form.description} onChange={F('description')} /></div>
        </div>
      </Modal>
    </div>
  )
}

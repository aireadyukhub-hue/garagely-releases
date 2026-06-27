import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Edit2, Trash2, Plus, Phone, Mail, MapPin, Car, Wrench } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import CallButton from '@/components/CallButton'
import api from '@/lib/api'
import { Customer, Vehicle, Job } from '@/types'
import { formatDate, JOB_STATUS_COLORS, JOB_STATUS_LABELS } from '@/lib/utils'
import { cn } from '@/lib/utils'

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [editOpen, setEditOpen] = useState(false)
  const [form, setForm] = useState<Partial<Customer>>({})
  const [saving, setSaving] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const load = () => api.getCustomer(Number(id)).then((d: unknown) => {
    const data = d as { customer: Customer; vehicles: Vehicle[]; jobs: Job[] }
    setCustomer(data.customer)
    setVehicles(data.vehicles)
    setJobs(data.jobs)
    setForm(data.customer)
  })

  useEffect(() => { load() }, [id])

  const handleSave = async () => {
    setSaving(true)
    await api.updateCustomer(Number(id), form)
    await load()
    setEditOpen(false)
    setSaving(false)
  }

  const handleDelete = async () => {
    await api.deleteCustomer(Number(id))
    navigate('/customers')
  }

  const F = (field: keyof Customer) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [field]: e.target.value }))

  if (!customer) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="pt-2">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/customers')} className="btn-ghost p-2">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <h1 className="page-title">{customer.first_name} {customer.last_name}</h1>
          <p className="text-sm text-zinc-500">Customer since {formatDate(customer.created_at)}</p>
        </div>
        <button onClick={() => setEditOpen(true)} className="btn-secondary">
          <Edit2 className="w-4 h-4" /> Edit
        </button>
        <button onClick={() => setDeleteOpen(true)} className="btn-danger">
          <Trash2 className="w-4 h-4" /> Delete
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Contact info */}
        <div className="card">
          <div className="card-header"><span className="text-sm font-medium text-zinc-300">Contact Details</span></div>
          <div className="card-body space-y-3">
            {customer.email && (
              <div className="flex items-center gap-2.5 text-sm">
                <Mail className="w-4 h-4 text-zinc-500 shrink-0" />
                <a href={`mailto:${customer.email}`} className="text-blue-400 hover:text-blue-300">{customer.email}</a>
              </div>
            )}
            {customer.phone && (
              <div className="flex items-center gap-2.5 text-sm">
                <Phone className="w-4 h-4 text-zinc-500 shrink-0" />
                <span className="text-zinc-300">{customer.phone}</span>
                <CallButton number={customer.phone} className="ml-auto" />
              </div>
            )}
            {customer.mobile && (
              <div className="flex items-center gap-2.5 text-sm">
                <Phone className="w-4 h-4 text-zinc-500 shrink-0" />
                <span className="text-zinc-300">{customer.mobile} (mobile)</span>
                <CallButton number={customer.mobile} className="ml-auto" />
              </div>
            )}
            {(customer.address || customer.city) && (
              <div className="flex items-start gap-2.5 text-sm">
                <MapPin className="w-4 h-4 text-zinc-500 shrink-0 mt-0.5" />
                <div className="text-zinc-300">
                  {customer.address && <div>{customer.address}</div>}
                  {[customer.city, customer.postcode].filter(Boolean).join(', ')}
                </div>
              </div>
            )}
            {customer.notes && (
              <div className="pt-2 border-t border-zinc-800">
                <p className="text-xs text-zinc-500 mb-1">Notes</p>
                <p className="text-sm text-zinc-300">{customer.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Vehicles */}
        <div className="card lg:col-span-2">
          <div className="card-header flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-300 flex items-center gap-2">
              <Car className="w-4 h-4" /> Vehicles ({vehicles.length})
            </span>
            <Link to={`/vehicles?customerId=${id}`} className="text-xs text-blue-400 hover:text-blue-300">Add vehicle →</Link>
          </div>
          {vehicles.length === 0 ? (
            <div className="card-body text-sm text-zinc-500">No vehicles registered</div>
          ) : (
            <div>
              {vehicles.map(v => (
                <Link key={v.id} to={`/vehicles/${v.id}`}
                  className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800/50 last:border-0 hover:bg-zinc-800/30 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-zinc-200">{v.registration} — {v.make} {v.model}</p>
                    <p className="text-xs text-zinc-500">{v.year} · {v.colour} · {v.fuel_type}</p>
                  </div>
                  <div className="text-right text-xs text-zinc-500">
                    <div>MOT: {formatDate(v.mot_due)}</div>
                    <div>Service: {formatDate(v.service_due)}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Job history */}
      <div className="card mt-5">
        <div className="card-header flex items-center gap-2">
          <Wrench className="w-4 h-4 text-zinc-400" />
          <span className="text-sm font-medium text-zinc-300">Job History ({jobs.length})</span>
        </div>
        {jobs.length === 0 ? (
          <div className="card-body text-sm text-zinc-500">No jobs yet</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left px-5 py-2.5 text-xs text-zinc-500 font-medium uppercase tracking-wide">Job #</th>
                <th className="text-left px-5 py-2.5 text-xs text-zinc-500 font-medium uppercase tracking-wide">Title</th>
                <th className="text-left px-5 py-2.5 text-xs text-zinc-500 font-medium uppercase tracking-wide">Vehicle</th>
                <th className="text-left px-5 py-2.5 text-xs text-zinc-500 font-medium uppercase tracking-wide">Status</th>
                <th className="text-left px-5 py-2.5 text-xs text-zinc-500 font-medium uppercase tracking-wide">Date</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map(j => (
                <tr key={j.id} className="table-row-hover border-b border-zinc-800/40 last:border-0">
                  <td className="px-5 py-3">
                    <Link to={`/jobs/${j.id}`} className="font-mono text-blue-400 hover:text-blue-300 text-xs">{j.job_number}</Link>
                  </td>
                  <td className="px-5 py-3 text-zinc-200">{j.title}</td>
                  <td className="px-5 py-3 text-zinc-400">{(j as { registration?: string }).registration}</td>
                  <td className="px-5 py-3">
                    <span className={cn('status-badge', JOB_STATUS_COLORS[j.status])}>{JOB_STATUS_LABELS[j.status]}</span>
                  </td>
                  <td className="px-5 py-3 text-zinc-500 text-xs">{formatDate(j.booked_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Edit modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Customer"
        footer={
          <>
            <button onClick={() => setEditOpen(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save'}</button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="label">First Name</label><input className="input" value={form.first_name || ''} onChange={F('first_name')} /></div>
            <div><label className="label">Last Name</label><input className="input" value={form.last_name || ''} onChange={F('last_name')} /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="label">Email</label><input type="email" className="input" value={form.email || ''} onChange={F('email')} /></div>
            <div><label className="label">Phone</label><input className="input" value={form.phone || ''} onChange={F('phone')} /></div>
          </div>
          <div><label className="label">Mobile</label><input className="input" value={form.mobile || ''} onChange={F('mobile')} /></div>
          <div><label className="label">Address</label><input className="input" value={form.address || ''} onChange={F('address')} /></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="label">City</label><input className="input" value={form.city || ''} onChange={F('city')} /></div>
            <div><label className="label">Postcode</label><input className="input" value={form.postcode || ''} onChange={F('postcode')} /></div>
          </div>
          <div><label className="label">Notes</label><textarea className="textarea" rows={3} value={form.notes || ''} onChange={F('notes')} /></div>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete Customer"
        footer={
          <>
            <button onClick={() => setDeleteOpen(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleDelete} className="btn-danger">Delete Customer</button>
          </>
        }
      >
        <p className="text-zinc-300">Are you sure you want to delete <strong>{customer.first_name} {customer.last_name}</strong>? This will also delete all their vehicles and jobs.</p>
      </Modal>
    </div>
  )
}

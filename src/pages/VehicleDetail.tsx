import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Edit2, Trash2, AlertTriangle, Clock, Wrench } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import api from '@/lib/api'
import { Vehicle, Job, Customer } from '@/types'
import { formatDate, isOverdue, isDueSoon, JOB_STATUS_COLORS, JOB_STATUS_LABELS, cn } from '@/lib/utils'

export default function VehicleDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [vehicle, setVehicle] = useState<Vehicle | null>(null)
  const [jobs, setJobs] = useState<Job[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [editOpen, setEditOpen] = useState(false)
  const [form, setForm] = useState<Partial<Vehicle>>({})
  const [saving, setSaving] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const load = () => api.getVehicle(Number(id)).then((d: unknown) => {
    const data = d as { vehicle: Vehicle; jobs: Job[]; serviceHistory: Job[] }
    setVehicle(data.vehicle)
    setJobs(data.jobs)
    setForm(data.vehicle)
  })

  useEffect(() => {
    load()
    api.getCustomers().then(d => setCustomers(d as Customer[]))
  }, [id])

  const handleSave = async () => {
    setSaving(true)
    await api.updateVehicle(Number(id), form)
    await load()
    setEditOpen(false)
    setSaving(false)
  }

  const handleDelete = async () => {
    await api.deleteVehicle(Number(id))
    navigate('/vehicles')
  }

  const F = (field: keyof Vehicle) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [field]: field === 'year' || field === 'mileage' ? Number(e.target.value) : e.target.value }))

  if (!vehicle) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const motStatus = isOverdue(vehicle.mot_due) ? 'overdue' : isDueSoon(vehicle.mot_due) ? 'soon' : 'ok'
  const svcStatus = isOverdue(vehicle.service_due) ? 'overdue' : isDueSoon(vehicle.service_due) ? 'soon' : 'ok'

  return (
    <div className="pt-2">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/vehicles')} className="btn-ghost p-2"><ArrowLeft className="w-4 h-4" /></button>
        <div className="flex-1">
          <h1 className="page-title font-mono">{vehicle.registration}</h1>
          <p className="text-sm text-zinc-500">{vehicle.year} {vehicle.make} {vehicle.model} · {vehicle.colour} · {vehicle.fuel_type}</p>
        </div>
        <button onClick={() => setEditOpen(true)} className="btn-secondary"><Edit2 className="w-4 h-4" /> Edit</button>
        <button onClick={() => setDeleteOpen(true)} className="btn-danger"><Trash2 className="w-4 h-4" /></button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
        {/* Vehicle info */}
        <div className="card">
          <div className="card-header"><span className="text-sm font-medium text-zinc-300">Details</span></div>
          <div className="card-body space-y-2 text-sm">
            {[
              ['Owner', <Link to={`/customers/${vehicle.customer_id}`} className="text-blue-400 hover:text-blue-300">{vehicle.first_name} {vehicle.last_name}</Link>],
              ['Registration', <span className="font-mono">{vehicle.registration}</span>],
              ['Make / Model', `${vehicle.make} ${vehicle.model}`],
              ['Year', vehicle.year],
              ['Colour', vehicle.colour || '—'],
              ['Fuel Type', vehicle.fuel_type || '—'],
              ['Engine', vehicle.engine_size || '—'],
              ['Mileage', vehicle.mileage ? `${vehicle.mileage.toLocaleString()} mi` : '—'],
              ['VIN', <span className="font-mono text-xs">{vehicle.vin || '—'}</span>],
            ].map(([label, value]) => (
              <div key={String(label)} className="flex items-center justify-between">
                <span className="text-zinc-500">{label}</span>
                <span className="text-zinc-200">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Status cards */}
        <div className="space-y-4">
          <div className={cn('card p-4', motStatus === 'overdue' ? 'border-red-500/30' : motStatus === 'soon' ? 'border-amber-500/30' : '')}>
            <div className="flex items-center gap-2 mb-2">
              {motStatus !== 'ok' && <AlertTriangle className={cn('w-4 h-4', motStatus === 'overdue' ? 'text-red-400' : 'text-amber-400')} />}
              <span className="text-sm font-medium text-zinc-300">MOT Due</span>
            </div>
            <p className={cn('text-xl font-semibold', motStatus === 'overdue' ? 'text-red-400' : motStatus === 'soon' ? 'text-amber-400' : 'text-white')}>
              {formatDate(vehicle.mot_due)}
            </p>
            {motStatus === 'overdue' && <p className="text-xs text-red-400 mt-1">Overdue!</p>}
            {motStatus === 'soon' && <p className="text-xs text-amber-400 mt-1">Due within 30 days</p>}
          </div>

          <div className={cn('card p-4', svcStatus === 'overdue' ? 'border-red-500/30' : svcStatus === 'soon' ? 'border-orange-500/30' : '')}>
            <div className="flex items-center gap-2 mb-2">
              {svcStatus !== 'ok' && <Clock className={cn('w-4 h-4', svcStatus === 'overdue' ? 'text-red-400' : 'text-orange-400')} />}
              <span className="text-sm font-medium text-zinc-300">Service Due</span>
            </div>
            <p className={cn('text-xl font-semibold', svcStatus === 'overdue' ? 'text-red-400' : svcStatus === 'soon' ? 'text-orange-400' : 'text-white')}>
              {formatDate(vehicle.service_due)}
            </p>
          </div>
        </div>

        {/* Notes */}
        {vehicle.notes && (
          <div className="card">
            <div className="card-header"><span className="text-sm font-medium text-zinc-300">Notes</span></div>
            <div className="card-body text-sm text-zinc-300">{vehicle.notes}</div>
          </div>
        )}
      </div>

      {/* Service history */}
      <div className="card">
        <div className="card-header flex items-center gap-2">
          <Wrench className="w-4 h-4 text-zinc-400" />
          <span className="text-sm font-medium text-zinc-300">Job History ({jobs.length})</span>
        </div>
        {jobs.length === 0 ? (
          <div className="card-body text-sm text-zinc-500">No jobs for this vehicle</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                {['Job #', 'Title', 'Status', 'Date', 'Notes'].map(h => (
                  <th key={h} className="text-left px-5 py-2.5 text-xs text-zinc-500 font-medium uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {jobs.map(j => (
                <tr key={j.id} className="table-row-hover border-b border-zinc-800/40 last:border-0">
                  <td className="px-5 py-3">
                    <Link to={`/jobs/${j.id}`} className="font-mono text-blue-400 hover:text-blue-300 text-xs">{j.job_number}</Link>
                  </td>
                  <td className="px-5 py-3 text-zinc-200">{j.title}</td>
                  <td className="px-5 py-3">
                    <span className={cn('status-badge', JOB_STATUS_COLORS[j.status])}>{JOB_STATUS_LABELS[j.status]}</span>
                  </td>
                  <td className="px-5 py-3 text-zinc-500 text-xs">{formatDate(j.booked_date)}</td>
                  <td className="px-5 py-3 text-zinc-500 text-xs max-w-xs truncate">{j.technician_notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Edit modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Vehicle" size="lg"
        footer={
          <>
            <button onClick={() => setEditOpen(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save'}</button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label">Customer</label>
            <select className="select" value={form.customer_id || ''} onChange={F('customer_id')}>
              {customers.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="label">Registration</label><input className="input uppercase" value={form.registration || ''} onChange={F('registration')} /></div>
            <div><label className="label">Make</label><input className="input" value={form.make || ''} onChange={F('make')} /></div>
            <div><label className="label">Model</label><input className="input" value={form.model || ''} onChange={F('model')} /></div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div><label className="label">Year</label><input type="number" className="input" value={form.year || ''} onChange={F('year')} /></div>
            <div><label className="label">Colour</label><input className="input" value={form.colour || ''} onChange={F('colour')} /></div>
            <div><label className="label">Fuel</label>
              <select className="select" value={form.fuel_type || 'Petrol'} onChange={F('fuel_type')}>
                {['Petrol', 'Diesel', 'Hybrid', 'Electric', 'LPG'].map(f => <option key={f}>{f}</option>)}
              </select>
            </div>
            <div><label className="label">Mileage</label><input type="number" className="input" value={form.mileage || ''} onChange={F('mileage')} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">MOT Due</label><input type="date" className="input" value={form.mot_due || ''} onChange={F('mot_due')} /></div>
            <div><label className="label">Service Due</label><input type="date" className="input" value={form.service_due || ''} onChange={F('service_due')} /></div>
          </div>
          <div><label className="label">VIN</label><input className="input font-mono" value={form.vin || ''} onChange={F('vin')} /></div>
          <div><label className="label">Notes</label><textarea className="textarea" rows={2} value={form.notes || ''} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} /></div>
        </div>
      </Modal>

      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete Vehicle"
        footer={
          <>
            <button onClick={() => setDeleteOpen(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleDelete} className="btn-danger">Delete</button>
          </>
        }
      >
        <p className="text-zinc-300">Delete <strong className="font-mono">{vehicle.registration}</strong>? This cannot be undone.</p>
      </Modal>
    </div>
  )
}

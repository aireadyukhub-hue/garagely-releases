import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Plus, Search, AlertTriangle, Clock } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import NumberField from '@/components/ui/NumberField'
import api from '@/lib/api'
import { Vehicle, Customer } from '@/types'
import { formatDate, isOverdue, isDueSoon, cn } from '@/lib/utils'

const EMPTY_V = {
  customer_id: 0, registration: '', make: '', model: '', year: new Date().getFullYear(),
  colour: '', vin: '', engine_size: '', fuel_type: 'Petrol', mileage: 0,
  mot_due: '', service_due: '', notes: ''
}

export default function Vehicles() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<Partial<Vehicle>>(EMPTY_V)
  const [saving, setSaving] = useState(false)
  const [looking, setLooking] = useState(false)
  const [lookupMsg, setLookupMsg] = useState<string | null>(null)
  const [searchParams] = useSearchParams()
  const preselectedCustomer = searchParams.get('customerId')

  const doLookup = async () => {
    const reg = String(form.registration || '').trim()
    if (!reg) return
    setLooking(true); setLookupMsg(null)
    try {
      const v = await api.lookupVehicle(reg)
      setForm(f => ({
        ...f,
        registration: v.registration || f.registration,
        make: v.make || f.make, model: v.model || f.model,
        colour: v.colour || f.colour, fuel_type: v.fuel_type || f.fuel_type,
        engine_size: v.engine_size || f.engine_size,
        year: v.year || f.year, mot_due: v.mot_due || f.mot_due,
        mileage: v.mileage || f.mileage,
      }))
      const name = [v.make, v.model].filter(Boolean).join(' ')
      setLookupMsg(name ? `Found: ${name}` : 'Found vehicle')
    } catch (e) {
      setLookupMsg((e as Error).message || 'Lookup failed')
    } finally {
      setLooking(false)
    }
  }

  const load = () => api.getVehicles().then(d => setVehicles(d as Vehicle[]))
  useEffect(() => {
    load()
    api.getCustomers().then(d => setCustomers(d as Customer[]))
  }, [])

  useEffect(() => {
    if (preselectedCustomer) {
      setForm(f => ({ ...f, customer_id: Number(preselectedCustomer) }))
      setModalOpen(true)
    }
  }, [preselectedCustomer])

  const filtered = vehicles.filter(v =>
    `${v.registration} ${v.make} ${v.model} ${v.first_name} ${v.last_name}`
      .toLowerCase().includes(search.toLowerCase())
  )

  const handleSave = async () => {
    setSaving(true)
    await api.createVehicle(form)
    setModalOpen(false)
    setForm(EMPTY_V)
    await load()
    setSaving(false)
  }

  const F = (field: keyof Vehicle) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [field]: field === 'year' || field === 'mileage' || field === 'customer_id' ? Number(e.target.value) : e.target.value }))

  return (
    <div className="pt-2">
      <div className="page-header">
        <h1 className="page-title">Vehicles</h1>
        <button onClick={() => { setForm(EMPTY_V); setModalOpen(true) }} className="btn-primary">
          <Plus className="w-4 h-4" /> Add Vehicle
        </button>
      </div>

      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input className="input pl-9" placeholder="Search by reg, make, model, customer…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800">
              {['Registration', 'Vehicle', 'Customer', 'Mileage', 'MOT Due', 'Service Due'].map(h => (
                <th key={h} className="text-left px-5 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-5 py-10 text-center text-zinc-500">
                {search ? 'No vehicles match your search' : 'No vehicles yet'}
              </td></tr>
            ) : filtered.map(v => (
              <tr key={v.id} className="table-row-hover border-b border-zinc-800/50 last:border-0">
                <td className="px-5 py-3.5">
                  <Link to={`/vehicles/${v.id}`} className="font-mono font-semibold text-zinc-200 hover:text-white text-xs tracking-wider">{v.registration}</Link>
                </td>
                <td className="px-5 py-3.5">
                  <div className="font-medium text-zinc-200">{v.make} {v.model}</div>
                  <div className="text-xs text-zinc-500">{v.year} · {v.colour} · {v.fuel_type}</div>
                </td>
                <td className="px-5 py-3.5">
                  <Link to={`/customers/${v.customer_id}`} className="text-blue-400 hover:text-blue-300">
                    {v.first_name} {v.last_name}
                  </Link>
                </td>
                <td className="px-5 py-3.5 text-zinc-400">{v.mileage ? v.mileage.toLocaleString() + ' mi' : '—'}</td>
                <td className="px-5 py-3.5">
                  <span className={cn('flex items-center gap-1.5 text-xs font-medium',
                    isOverdue(v.mot_due) ? 'text-red-400' : isDueSoon(v.mot_due) ? 'text-amber-400' : 'text-zinc-400'
                  )}>
                    {(isOverdue(v.mot_due) || isDueSoon(v.mot_due)) && <AlertTriangle className="w-3 h-3" />}
                    {formatDate(v.mot_due)}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <span className={cn('flex items-center gap-1.5 text-xs font-medium',
                    isOverdue(v.service_due) ? 'text-red-400' : isDueSoon(v.service_due) ? 'text-orange-400' : 'text-zinc-400'
                  )}>
                    {(isOverdue(v.service_due) || isDueSoon(v.service_due)) && <Clock className="w-3 h-3" />}
                    {formatDate(v.service_due)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Vehicle" size="lg"
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleSave} disabled={saving || !form.registration || !form.make || !form.customer_id} className="btn-primary">
              {saving ? 'Saving…' : 'Save Vehicle'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label">Customer *</label>
            <select className="select" value={form.customer_id || ''} onChange={F('customer_id')}>
              <option value="">Select customer…</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Registration *</label>
            <div className="flex gap-2">
              <input className="input uppercase flex-1" value={form.registration} onChange={F('registration')} placeholder="BD21 XYZ" />
              <button type="button" onClick={doLookup} disabled={looking || !form.registration} className="btn-secondary whitespace-nowrap">
                <Search className="w-4 h-4" /> {looking ? 'Looking…' : 'Look up'}
              </button>
            </div>
            {lookupMsg && <p className={cn('text-xs mt-1', lookupMsg.startsWith('Found') ? 'text-green-400' : 'text-amber-400')}>{lookupMsg}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Make *</label><input className="input" value={form.make} onChange={F('make')} /></div>
            <div><label className="label">Model</label><input className="input" value={form.model} onChange={F('model')} /></div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div><label className="label">Year</label><NumberField className="input" value={form.year} decimal={false} onChange={n => setForm(f => ({ ...f, year: n }))} /></div>
            <div><label className="label">Colour</label><input className="input" value={form.colour} onChange={F('colour')} /></div>
            <div><label className="label">Fuel Type</label>
              <select className="select" value={form.fuel_type} onChange={F('fuel_type')}>
                {['Petrol', 'Diesel', 'Hybrid', 'Electric', 'LPG'].map(f => <option key={f}>{f}</option>)}
              </select>
            </div>
            <div><label className="label">Mileage</label><NumberField className="input" value={form.mileage} decimal={false} onChange={n => setForm(f => ({ ...f, mileage: n }))} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">MOT Due</label><input type="date" className="input" value={form.mot_due} onChange={F('mot_due')} /></div>
            <div><label className="label">Service Due</label><input type="date" className="input" value={form.service_due} onChange={F('service_due')} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Engine Size (cc)</label><input className="input" value={form.engine_size} onChange={F('engine_size')} placeholder="e.g. 1998" /></div>
            <div><label className="label">VIN</label><input className="input font-mono" value={form.vin} onChange={F('vin')} /></div>
          </div>
          <div><label className="label">Notes</label><textarea className="textarea" rows={2} value={form.notes} onChange={(e) => setForm(p => ({ ...p, notes: e.target.value }))} /></div>
        </div>
      </Modal>
    </div>
  )
}

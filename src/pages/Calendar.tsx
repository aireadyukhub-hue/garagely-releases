import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, Clock } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import api from '@/lib/api'
import { Booking, Customer, Vehicle } from '@/types'
import { formatDate, cn } from '@/lib/utils'
import {
  format, startOfWeek, endOfWeek, addDays, addWeeks, subWeeks,
  isSameDay, parseISO, startOfDay, isValid
} from 'date-fns'

const HOURS = Array.from({ length: 11 }, (_, i) => i + 7) // 7am–5pm
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const BOOKING_COLORS = [
  'bg-blue-500/20 border-blue-500/40 text-blue-300',
  'bg-purple-500/20 border-purple-500/40 text-purple-300',
  'bg-green-500/20 border-green-500/40 text-green-300',
  'bg-amber-500/20 border-amber-500/40 text-amber-300',
  'bg-pink-500/20 border-pink-500/40 text-pink-300',
]

const EMPTY_B = { customer_id: 0, vehicle_id: 0, job_id: null, title: '', start_time: '', end_time: '', notes: '', status: 'confirmed' }

export default function Calendar() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<Partial<typeof EMPTY_B>>(EMPTY_B)
  const [saving, setSaving] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)

  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 })

  const load = () => {
    const from = format(weekStart, "yyyy-MM-dd'T'00:00:00")
    const to = format(weekEnd, "yyyy-MM-dd'T'23:59:59")
    api.getBookings({ from, to }).then(d => setBookings(d as Booking[]))
  }

  useEffect(() => { load() }, [weekStart])
  useEffect(() => {
    api.getCustomers().then(d => setCustomers(d as Customer[]))
    api.getVehicles().then(d => setVehicles(d as Vehicle[]))
  }, [])

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const getBookingsForDayHour = (day: Date, hour: number) =>
    bookings.filter(b => {
      try {
        const start = parseISO(b.start_time)
        return isSameDay(start, day) && start.getHours() === hour
      } catch { return false }
    })

  const handleOpenNew = (day: Date, hour: number) => {
    const start = new Date(day)
    start.setHours(hour, 0, 0, 0)
    const end = new Date(start)
    end.setHours(hour + 1)
    setForm({ ...EMPTY_B, start_time: start.toISOString().slice(0, 16), end_time: end.toISOString().slice(0, 16) })
    setModalOpen(true)
  }

  const handleSave = async () => {
    setSaving(true)
    await api.createBooking({ ...form, start_time: form.start_time + ':00', end_time: form.end_time + ':00' })
    setModalOpen(false)
    setForm(EMPTY_B)
    await load()
    setSaving(false)
  }

  const handleDelete = async (id: number) => {
    await api.deleteBooking(id)
    await load()
  }

  const customerVehicles = vehicles.filter(v => v.customer_id === form.customer_id)

  return (
    <div className="pt-2">
      <div className="page-header">
        <div className="flex items-center gap-4">
          <h1 className="page-title">Calendar</h1>
          <div className="flex items-center gap-2">
            <button onClick={() => setWeekStart(w => subWeeks(w, 1))} className="btn-ghost p-2"><ChevronLeft className="w-4 h-4" /></button>
            <span className="text-sm text-zinc-300 font-medium w-48 text-center">
              {format(weekStart, 'd MMM')} – {format(weekEnd, 'd MMM yyyy')}
            </span>
            <button onClick={() => setWeekStart(w => addWeeks(w, 1))} className="btn-ghost p-2"><ChevronRight className="w-4 h-4" /></button>
            <button onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))} className="btn-secondary text-xs py-1.5 px-3">Today</button>
          </div>
        </div>
        <button onClick={() => { setForm(EMPTY_B); setModalOpen(true) }} className="btn-primary">
          <Plus className="w-4 h-4" /> New Booking
        </button>
      </div>

      {/* Week grid */}
      <div className="card overflow-auto">
        <div className="grid" style={{ gridTemplateColumns: '60px repeat(7, 1fr)', minWidth: '800px' }}>
          {/* Header row */}
          <div className="border-b border-zinc-800 py-3" />
          {weekDays.map((day, i) => (
            <div key={i} className={cn(
              'border-b border-zinc-800 py-3 px-2 text-center',
              isSameDay(day, new Date()) ? 'bg-[#1F6FEB]/10' : ''
            )}>
              <div className="text-xs text-zinc-500">{DAYS[i]}</div>
              <div className={cn('text-sm font-semibold mt-0.5', isSameDay(day, new Date()) ? 'text-[#3B82F6]' : 'text-zinc-200')}>
                {format(day, 'd')}
              </div>
            </div>
          ))}

          {/* Hour rows */}
          {HOURS.map(hour => (
            <>
              <div key={`hour-${hour}`} className="border-b border-zinc-800/50 h-14 flex items-start justify-end pr-2 pt-1">
                <span className="text-xs text-zinc-600">{hour}:00</span>
              </div>
              {weekDays.map((day, di) => {
                const dayBookings = getBookingsForDayHour(day, hour)
                return (
                  <div
                    key={`${di}-${hour}`}
                    className={cn(
                      'border-b border-l border-zinc-800/50 h-14 p-0.5 cursor-pointer hover:bg-zinc-800/20 transition-colors relative',
                      isSameDay(day, new Date()) ? 'bg-[#1F6FEB]/5' : ''
                    )}
                    onClick={() => handleOpenNew(day, hour)}
                  >
                    {dayBookings.map((b, bi) => (
                      <div key={b.id} onClick={e => e.stopPropagation()}
                        className={cn('rounded px-1.5 py-1 text-xs border cursor-pointer group', BOOKING_COLORS[bi % BOOKING_COLORS.length])}>
                        <div className="font-medium truncate leading-tight">{b.title}</div>
                        <div className="flex items-center gap-1 text-[10px] opacity-70 leading-tight">
                          <Clock className="w-2.5 h-2.5" />
                          {new Date(b.start_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <button
                          onClick={() => handleDelete(b.id)}
                          className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 text-xs leading-none p-0.5"
                        >×</button>
                      </div>
                    ))}
                  </div>
                )
              })}
            </>
          ))}
        </div>
      </div>

      {/* New booking modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Booking"
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleSave} disabled={saving || !form.title} className="btn-primary">{saving ? 'Saving…' : 'Save'}</button>
          </>
        }
      >
        <div className="space-y-4">
          <div><label className="label">Title *</label><input className="input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. MOT - Ford Focus BD21 XYZ" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Start</label><input type="datetime-local" className="input" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} /></div>
            <div><label className="label">End</label><input type="datetime-local" className="input" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Customer</label>
              <select className="select" value={form.customer_id || ''} onChange={e => setForm(f => ({ ...f, customer_id: Number(e.target.value), vehicle_id: 0 }))}>
                <option value="">Select…</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Vehicle</label>
              <select className="select" value={form.vehicle_id || ''} onChange={e => setForm(f => ({ ...f, vehicle_id: Number(e.target.value) }))} disabled={!form.customer_id}>
                <option value="">Select…</option>
                {customerVehicles.map(v => <option key={v.id} value={v.id}>{v.registration} – {v.make} {v.model}</option>)}
              </select>
            </div>
          </div>
          <div><label className="label">Notes</label><textarea className="textarea" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
        </div>
      </Modal>
    </div>
  )
}

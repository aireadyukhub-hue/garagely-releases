import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Plus, Clock } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import api from '@/lib/api'
import { Booking, Customer, Vehicle } from '@/types'
import { cn } from '@/lib/utils'
import {
  format, startOfWeek, endOfWeek, addDays, subDays, addWeeks, subWeeks,
  startOfMonth, endOfMonth, addMonths, subMonths, eachDayOfInterval,
  isSameDay, isSameMonth, parseISO,
} from 'date-fns'

const HOURS = Array.from({ length: 12 }, (_, i) => i + 7) // 7am–6pm
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const BOOKING_COLORS = [
  'bg-blue-500/20 border-blue-500/40 text-blue-300',
  'bg-purple-500/20 border-purple-500/40 text-purple-300',
  'bg-green-500/20 border-green-500/40 text-green-300',
  'bg-amber-500/20 border-amber-500/40 text-amber-300',
  'bg-pink-500/20 border-pink-500/40 text-pink-300',
]

const EMPTY_B = { customer_id: 0, vehicle_id: 0, job_id: null, title: '', start_time: '', end_time: '', notes: '', status: 'confirmed' }
const fmtTime = (s: string) => { try { return parseISO(s).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) } catch { return '' } }

type View = 'day' | 'week' | 'month'
// Bookings come back joined with customer/vehicle fields.
type B = Booking & { first_name?: string; last_name?: string; registration?: string; make?: string; model?: string; job_id?: number | null }

export default function Calendar() {
  const [view, setView] = useState<View>('week')
  const [cursor, setCursor] = useState(() => new Date())
  const [bookings, setBookings] = useState<B[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<Partial<typeof EMPTY_B>>(EMPTY_B)
  const [saving, setSaving] = useState(false)
  const [detail, setDetail] = useState<B | null>(null)

  // ── Visible range ──────────────────────────────────────────────────────────
  const weekStart = startOfWeek(cursor, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(cursor, { weekStartsOn: 1 })
  const gridStart = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 })
  const gridEnd = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 })

  const rangeStart = view === 'day' ? cursor : view === 'week' ? weekStart : gridStart
  const rangeEnd = view === 'day' ? cursor : view === 'week' ? weekEnd : gridEnd

  const load = () => {
    const from = format(rangeStart, "yyyy-MM-dd'T'00:00:00")
    const to = format(rangeEnd, "yyyy-MM-dd'T'23:59:59")
    api.getBookings({ from, to }).then(d => setBookings(d as B[]))
  }

  useEffect(() => { load() }, [view, cursor]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    api.getCustomers().then(d => setCustomers(d as Customer[]))
    api.getVehicles().then(d => setVehicles(d as Vehicle[]))
  }, [])

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const monthDays = eachDayOfInterval({ start: gridStart, end: gridEnd })
  const gridDays = view === 'day' ? [cursor] : weekDays // day & week share the time grid

  const bookingsForDay = (day: Date) =>
    bookings.filter(b => { try { return isSameDay(parseISO(b.start_time), day) } catch { return false } })
  const getBookingsForDayHour = (day: Date, hour: number) =>
    bookingsForDay(day).filter(b => { try { return parseISO(b.start_time).getHours() === hour } catch { return false } })

  const openNewAt = (day: Date, hour: number) => {
    const start = new Date(day); start.setHours(hour, 0, 0, 0)
    const end = new Date(start); end.setHours(hour + 1)
    setForm({ ...EMPTY_B, start_time: start.toISOString().slice(0, 16), end_time: end.toISOString().slice(0, 16) })
    setModalOpen(true)
  }

  const handleSave = async () => {
    setSaving(true)
    await api.createBooking({ ...form, start_time: form.start_time + ':00', end_time: form.end_time + ':00' })
    setModalOpen(false); setForm(EMPTY_B); await load(); setSaving(false)
  }
  const handleDelete = async (id: number) => { await api.deleteBooking(id); await load() }

  const prev = () => setCursor(c => (view === 'day' ? subDays(c, 1) : view === 'week' ? subWeeks(c, 1) : subMonths(c, 1)))
  const next = () => setCursor(c => (view === 'day' ? addDays(c, 1) : view === 'week' ? addWeeks(c, 1) : addMonths(c, 1)))

  const label = view === 'day' ? format(cursor, 'EEEE d MMM yyyy')
    : view === 'week' ? `${format(weekStart, 'd MMM')} – ${format(weekEnd, 'd MMM yyyy')}`
    : format(cursor, 'MMMM yyyy')

  const customerVehicles = vehicles.filter(v => v.customer_id === form.customer_id)

  return (
    <div className="pt-2">
      <div className="page-header">
        <div className="flex items-center gap-4">
          <h1 className="page-title">Calendar</h1>
          <div className="flex bg-zinc-800/60 rounded-lg p-0.5">
            {(['day', 'week', 'month'] as View[]).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={cn('px-3 py-1 rounded-md text-xs font-medium capitalize transition-colors',
                  view === v ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-200')}>
                {v}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={prev} className="btn-ghost p-2"><ChevronLeft className="w-4 h-4" /></button>
            <span className="text-sm text-zinc-300 font-medium w-52 text-center">{label}</span>
            <button onClick={next} className="btn-ghost p-2"><ChevronRight className="w-4 h-4" /></button>
            <button onClick={() => setCursor(new Date())} className="btn-secondary text-xs py-1.5 px-3">Today</button>
          </div>
        </div>
        <button onClick={() => { setForm(EMPTY_B); setModalOpen(true) }} className="btn-primary">
          <Plus className="w-4 h-4" /> New Booking
        </button>
      </div>

      {view === 'month' ? (
        /* ── Month grid ── */
        <div className="card overflow-hidden">
          <div className="grid grid-cols-7">
            {DAYS.map(d => (
              <div key={d} className="border-b border-zinc-800 py-2.5 text-center text-xs text-zinc-500 font-medium">{d}</div>
            ))}
            {monthDays.map((day, i) => {
              const dayBookings = bookingsForDay(day)
              const today = isSameDay(day, new Date())
              const outside = !isSameMonth(day, cursor)
              return (
                <div key={i} onClick={() => openNewAt(day, 9)}
                  className={cn('min-h-[104px] border-b border-l border-zinc-800/50 p-1.5 cursor-pointer hover:bg-zinc-800/20 transition-colors',
                    i % 7 === 0 ? 'border-l-0' : '', outside ? 'bg-zinc-900/30' : '')}>
                  <div className={cn('text-xs font-semibold mb-1 w-6 h-6 flex items-center justify-center rounded-full',
                    today ? 'bg-[#3B82F6] text-white' : outside ? 'text-zinc-600' : 'text-zinc-300')}>
                    {format(day, 'd')}
                  </div>
                  <div className="space-y-1">
                    {dayBookings.slice(0, 3).map((b, bi) => (
                      <div key={b.id} onClick={e => { e.stopPropagation(); setDetail(b) }}
                        className={cn('rounded px-1.5 py-0.5 text-[11px] border truncate cursor-pointer', BOOKING_COLORS[bi % BOOKING_COLORS.length])}>
                        <span className="opacity-70 mr-1">{fmtTime(b.start_time)}</span>{b.title}
                      </div>
                    ))}
                    {dayBookings.length > 3 && <div className="text-[10px] text-zinc-500 pl-1">+{dayBookings.length - 3} more</div>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        /* ── Day / Week time grid ── */
        <div className="card overflow-auto">
          <div className="grid" style={{ gridTemplateColumns: `60px repeat(${gridDays.length}, 1fr)`, minWidth: view === 'day' ? '420px' : '800px' }}>
            <div className="border-b border-zinc-800 py-3" />
            {gridDays.map((day, i) => (
              <div key={i} className={cn('border-b border-zinc-800 py-3 px-2 text-center', isSameDay(day, new Date()) ? 'bg-[#1F6FEB]/10' : '')}>
                <div className="text-xs text-zinc-500">{DAYS[(day.getDay() + 6) % 7]}</div>
                <div className={cn('text-sm font-semibold mt-0.5', isSameDay(day, new Date()) ? 'text-[#3B82F6]' : 'text-zinc-200')}>{format(day, 'd')}</div>
              </div>
            ))}
            {HOURS.map(hour => (
              <div key={`row-${hour}`} className="contents">
                <div className="border-b border-zinc-800/50 h-14 flex items-start justify-end pr-2 pt-1">
                  <span className="text-xs text-zinc-600">{hour}:00</span>
                </div>
                {gridDays.map((day, di) => (
                  <div key={`${di}-${hour}`}
                    className={cn('border-b border-l border-zinc-800/50 h-14 p-0.5 cursor-pointer hover:bg-zinc-800/20 transition-colors', isSameDay(day, new Date()) ? 'bg-[#1F6FEB]/5' : '')}
                    onClick={() => openNewAt(day, hour)}>
                    {getBookingsForDayHour(day, hour).map((b, bi) => (
                      <div key={b.id} onClick={e => { e.stopPropagation(); setDetail(b) }}
                        className={cn('rounded px-1.5 py-1 text-xs border cursor-pointer', BOOKING_COLORS[bi % BOOKING_COLORS.length])}>
                        <div className="font-medium truncate leading-tight">{b.title}</div>
                        <div className="flex items-center gap-1 text-[10px] opacity-70 leading-tight">
                          <Clock className="w-2.5 h-2.5" />{fmtTime(b.start_time)}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* New booking modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Booking"
        footer={<>
          <button onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
          <button onClick={handleSave} disabled={saving || !form.title} className="btn-primary">{saving ? 'Saving…' : 'Save'}</button>
        </>}>
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

      {/* Booking detail modal */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title="Booking details"
        footer={<>
          {detail?.job_id && <Link to={`/jobs/${detail.job_id}`} onClick={() => setDetail(null)} className="btn-secondary">Open Job Sheet →</Link>}
          <button onClick={() => { if (detail) handleDelete(detail.id); setDetail(null) }} className="btn-danger">Delete</button>
          <button onClick={() => setDetail(null)} className="btn-secondary">Close</button>
        </>}>
        {detail && (
          <div className="space-y-3 text-sm">
            <div>
              <div className="text-zinc-500 text-xs">Title</div>
              <div className="text-zinc-100 font-medium text-base">{detail.title}</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><div className="text-zinc-500 text-xs">Date</div><div className="text-zinc-200">{format(parseISO(detail.start_time), 'EEE d MMM yyyy')}</div></div>
              <div><div className="text-zinc-500 text-xs">Time</div><div className="text-zinc-200">{fmtTime(detail.start_time)} – {fmtTime(detail.end_time)}</div></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><div className="text-zinc-500 text-xs">Customer</div><div className="text-zinc-200">{[detail.first_name, detail.last_name].filter(Boolean).join(' ') || '—'}</div></div>
              <div><div className="text-zinc-500 text-xs">Vehicle</div><div className="text-zinc-200 font-mono text-xs">{[detail.registration, detail.make, detail.model].filter(Boolean).join(' ') || '—'}</div></div>
            </div>
            {detail.notes && <div><div className="text-zinc-500 text-xs">Notes</div><div className="text-zinc-300 whitespace-pre-wrap">{detail.notes}</div></div>}
          </div>
        )}
      </Modal>
    </div>
  )
}

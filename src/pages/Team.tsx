import { useEffect, useState } from 'react'
import { Plus, Edit2, Trash2, CalendarOff } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import api from '@/lib/api'
import { formatDate, cn } from '@/lib/utils'

interface Technician { id: number; name: string; colour: string; active: boolean; work_days?: string[]; start_time?: string | null; end_time?: string | null }
interface TimeOff { id: number; technician_id: number; day: string; kind: 'off' | 'half'; note?: string }

// A friendly palette of distinct dot colours.
const SWATCHES = ['#F4A523', '#3B82F6', '#22C55E', '#A855F7', '#EC4899', '#EF4444', '#14B8A6', '#F97316', '#6366F1', '#84CC16']
const WD = [['mon', 'Mon'], ['tue', 'Tue'], ['wed', 'Wed'], ['thu', 'Thu'], ['fri', 'Fri'], ['sat', 'Sat'], ['sun', 'Sun']] as const
const EMPTY_T = { name: '', colour: SWATCHES[0], active: true, work_days: ['mon', 'tue', 'wed', 'thu', 'fri'] as string[], start_time: '08:00', end_time: '17:00' }

const shiftSummary = (t: Technician) => {
  const days = (t.work_days && t.work_days.length)
    ? WD.filter(([k]) => t.work_days!.includes(k)).map(([, l]) => l).join(', ')
    : 'No set days'
  const hrs = t.start_time && t.end_time ? `${t.start_time}–${t.end_time}` : ''
  return [days, hrs].filter(Boolean).join('  ·  ')
}

export default function Team() {
  const [techs, setTechs] = useState<Technician[]>([])
  const [timeOff, setTimeOff] = useState<TimeOff[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Technician | null>(null)
  const [form, setForm] = useState<typeof EMPTY_T>(EMPTY_T)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  // Book time-off form
  const [offTech, setOffTech] = useState<number | ''>('')
  const [offDay, setOffDay] = useState('')
  const [offKind, setOffKind] = useState<'off' | 'half'>('off')
  const [offNote, setOffNote] = useState('')

  const today = new Date().toISOString().slice(0, 10)

  const load = () => {
    api.getTechnicians(true).then(d => setTechs(d as Technician[]))
    api.getTimeOff(today).then(d => setTimeOff(d as TimeOff[]))
  }
  useEffect(() => { load() }, []) // eslint-disable-line

  const openNew = () => { setEditing(null); setForm(EMPTY_T); setModalOpen(true) }
  const openEdit = (t: Technician) => {
    setEditing(t)
    setForm({
      name: t.name, colour: t.colour, active: t.active,
      work_days: t.work_days?.length ? t.work_days : EMPTY_T.work_days,
      start_time: t.start_time || '08:00', end_time: t.end_time || '17:00',
    })
    setModalOpen(true)
  }
  const toggleDay = (key: string) =>
    setForm(f => ({ ...f, work_days: f.work_days.includes(key) ? f.work_days.filter(d => d !== key) : [...f.work_days, key] }))

  const handleSave = async () => {
    setSaving(true)
    if (editing) await api.updateTechnician(editing.id, form)
    else await api.createTechnician(form)
    setModalOpen(false); await load(); setSaving(false)
  }
  const handleDelete = async () => { if (deleteId) await api.deleteTechnician(deleteId); setDeleteId(null); await load() }

  const bookTimeOff = async () => {
    if (!offTech || !offDay) return
    await api.setTimeOff(Number(offTech), offDay, offKind, offNote.trim() || undefined)
    setOffDay(''); setOffNote(''); setOffKind('off')
    await load()
  }
  const removeTimeOff = async (t: TimeOff) => { await api.clearTimeOff(t.technician_id, t.day); await load() }

  const techName = (id: number) => techs.find(t => t.id === id)?.name || 'Unknown'
  const techColour = (id: number) => techs.find(t => t.id === id)?.colour || '#71717a'

  return (
    <div className="pt-2">
      <div className="page-header">
        <h1 className="page-title">Team</h1>
        <button onClick={openNew} className="btn-primary"><Plus className="w-4 h-4" /> New Technician</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Technicians list */}
        <div className="card overflow-hidden">
          <div className="card-header"><span className="text-sm font-medium text-zinc-300">Technicians</span></div>
          {techs.length === 0 ? (
            <div className="px-5 py-10 text-center text-zinc-500 text-sm">No technicians yet — add your team so you can colour-code the calendar.</div>
          ) : techs.map(t => (
            <div key={t.id} className="flex items-center gap-3 px-5 py-3.5 border-b border-zinc-800/50 last:border-0">
              <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: t.colour }} />
              <div className="flex-1 min-w-0">
                <div className={cn('font-medium', t.active ? 'text-zinc-200' : 'text-zinc-500 line-through')}>{t.name}</div>
                <div className="text-xs text-zinc-500 truncate">{shiftSummary(t)}</div>
              </div>
              {!t.active && <span className="text-xs text-zinc-600 shrink-0">inactive</span>}
              <button onClick={() => openEdit(t)} className="btn-ghost p-1.5"><Edit2 className="w-3.5 h-3.5" /></button>
              <button onClick={() => setDeleteId(t.id)} className="btn-ghost p-1.5 text-red-400 hover:text-red-300"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
        </div>

        {/* Book time off */}
        <div className="card">
          <div className="card-header"><span className="text-sm font-medium text-zinc-300">Book time off</span></div>
          <div className="card-body space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Technician</label>
                <select className="select" value={offTech} onChange={e => setOffTech(e.target.value ? Number(e.target.value) : '')}>
                  <option value="">Select…</option>
                  {techs.filter(t => t.active).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div><label className="label">Date</label><input type="date" className="input" value={offDay} onChange={e => setOffDay(e.target.value)} /></div>
            </div>
            <div>
              <label className="label">Type</label>
              <div className="flex bg-zinc-800/60 rounded-lg p-0.5 w-fit">
                {([['off', 'Full day off'], ['half', 'Half day']] as const).map(([v, lbl]) => (
                  <button key={v} onClick={() => setOffKind(v)}
                    className={cn('px-3 py-1.5 rounded-md text-sm font-medium transition-colors', offKind === v ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-200')}>
                    {lbl}
                  </button>
                ))}
              </div>
            </div>
            <div><label className="label">Note (optional)</label><input className="input" value={offNote} onChange={e => setOffNote(e.target.value)} placeholder="e.g. Doctor's appointment" /></div>
            <button onClick={bookTimeOff} disabled={!offTech || !offDay} className="btn-primary w-full justify-center"><CalendarOff className="w-4 h-4" /> Book time off</button>
          </div>
        </div>
      </div>

      {/* Upcoming time off */}
      <div className="card mt-5">
        <div className="card-header"><span className="text-sm font-medium text-zinc-300">Upcoming time off</span></div>
        {timeOff.length === 0 ? (
          <div className="px-5 py-8 text-center text-zinc-500 text-sm">No time off booked.</div>
        ) : timeOff.map(t => (
          <div key={t.id} className="flex items-center gap-3 px-5 py-3 border-b border-zinc-800/50 last:border-0 text-sm">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: techColour(t.technician_id) }} />
            <span className="text-zinc-200 font-medium w-32">{techName(t.technician_id)}</span>
            <span className="text-zinc-400 w-32">{formatDate(t.day)}</span>
            <span className={cn('status-badge', t.kind === 'half' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-zinc-600/20 text-zinc-400 border-zinc-600/30')}>
              {t.kind === 'half' ? 'Half day' : 'Day off'}
            </span>
            <span className="text-zinc-500 flex-1 truncate">{t.note}</span>
            <button onClick={() => removeTimeOff(t)} className="btn-ghost p-1.5 text-red-400 hover:text-red-300"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        ))}
      </div>

      {/* Technician modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Technician' : 'New Technician'}
        footer={<>
          <button onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
          <button onClick={handleSave} disabled={saving || !form.name.trim()} className="btn-primary">{saving ? 'Saving…' : 'Save'}</button>
        </>}>
        <div className="space-y-4">
          <div><label className="label">Name *</label><input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Dave Smith" /></div>
          <div>
            <label className="label">Calendar colour</label>
            <div className="flex flex-wrap gap-2">
              {SWATCHES.map(c => (
                <button key={c} onClick={() => setForm(f => ({ ...f, colour: c }))}
                  className={cn('w-8 h-8 rounded-full transition-transform', form.colour === c ? 'ring-2 ring-offset-2 ring-offset-[#16181D] ring-white scale-110' : 'hover:scale-105')}
                  style={{ backgroundColor: c }} aria-label={c} />
              ))}
            </div>
          </div>
          <div>
            <label className="label">Works on</label>
            <div className="flex flex-wrap gap-1.5">
              {WD.map(([key, lbl]) => (
                <button key={key} type="button" onClick={() => toggleDay(key)}
                  className={cn('px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                    form.work_days.includes(key) ? 'bg-[#F4A523]/15 border-[#F4A523]/40 text-[#F4A523]' : 'border-zinc-700 text-zinc-400 hover:text-zinc-200')}>
                  {lbl}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Starts</label><input type="time" className="input" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} /></div>
            <div><label className="label">Finishes</label><input type="time" className="input" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} /></div>
          </div>
          <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
            <input type="checkbox" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} className="accent-[#F4A523] w-4 h-4" />
            Active (shows on the calendar &amp; in pickers)
          </label>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal open={deleteId !== null} onClose={() => setDeleteId(null)} title="Delete Technician"
        footer={<>
          <button onClick={() => setDeleteId(null)} className="btn-secondary">Cancel</button>
          <button onClick={handleDelete} className="btn-danger">Delete</button>
        </>}>
        <p className="text-zinc-300">Delete this technician? Their bookings stay, but lose the colour tag. This can't be undone.</p>
      </Modal>
    </div>
  )
}

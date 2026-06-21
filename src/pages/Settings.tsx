import { useEffect, useState } from 'react'
import { Save, CheckCircle } from 'lucide-react'
import api from '@/lib/api'
import { Settings as SettingsType } from '@/types'

const DAYS_OH = [
  ['mon', 'Monday'], ['tue', 'Tuesday'], ['wed', 'Wednesday'], ['thu', 'Thursday'],
  ['fri', 'Friday'], ['sat', 'Saturday'], ['sun', 'Sunday'],
] as const
type DayHours = { open: boolean; from: string; to: string }
type OpeningHours = Record<string, DayHours>
const DEFAULT_OH: OpeningHours = {
  mon: { open: true, from: '08:00', to: '17:00' },
  tue: { open: true, from: '08:00', to: '17:00' },
  wed: { open: true, from: '08:00', to: '17:00' },
  thu: { open: true, from: '08:00', to: '17:00' },
  fri: { open: true, from: '08:00', to: '17:00' },
  sat: { open: true, from: '09:00', to: '13:00' },
  sun: { open: false, from: '09:00', to: '13:00' },
}

export default function Settings() {
  const [settings, setSettings] = useState<Partial<SettingsType>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    api.getSettings().then(d => {
      const s = (d as SettingsType) || {}
      if (!(s as { opening_hours?: OpeningHours }).opening_hours) {
        (s as { opening_hours?: OpeningHours }).opening_hours = DEFAULT_OH
      }
      setSettings(s)
    })
  }, [])

  const oh = ((settings as { opening_hours?: OpeningHours }).opening_hours) || DEFAULT_OH
  const setOH = (day: string, patch: Partial<DayHours>) =>
    setSettings(s => {
      const cur = ((s as { opening_hours?: OpeningHours }).opening_hours) || DEFAULT_OH
      return { ...s, opening_hours: { ...cur, [day]: { ...cur[day], ...patch } } } as Partial<SettingsType>
    })

  const handleSave = async () => {
    setSaving(true)
    await api.updateSettings(settings)
    // Tell the Layout to refresh the top-bar logo immediately.
    window.dispatchEvent(new Event('settings-updated'))
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  // Read an uploaded image, downscale to <=320px wide, store as a base64 PNG.
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const maxW = 320
        const scale = Math.min(1, maxW / img.width)
        const w = Math.round(img.width * scale)
        const h = Math.round(img.height * scale)
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
        setSettings(s => ({ ...s, logo_data: canvas.toDataURL('image/png') }))
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  }

  const F = (field: keyof SettingsType) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setSettings(s => ({ ...s, [field]: ['vat_rate', 'labour_rate', 'invoice_next', 'quote_next'].includes(field) ? Number(e.target.value) : e.target.value }))

  return (
    <div className="pt-2 max-w-2xl">
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <button onClick={handleSave} disabled={saving} className="btn-primary">
          {saved ? <><CheckCircle className="w-4 h-4" /> Saved!</> : <><Save className="w-4 h-4" />{saving ? 'Saving…' : 'Save Changes'}</>}
        </button>
      </div>

      <div className="space-y-5">
        {/* Business Details */}
        <div className="card">
          <div className="card-header"><span className="text-sm font-medium text-zinc-300">Business Details</span></div>
          <div className="card-body space-y-4">
            <div><label className="label">Business Name</label><input className="input" value={settings.business_name || ''} onChange={F('business_name')} /></div>
            <div><label className="label">Address</label><input className="input" value={settings.address || ''} onChange={F('address')} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Phone</label><input className="input" value={settings.phone || ''} onChange={F('phone')} /></div>
              <div><label className="label">Email</label><input type="email" className="input" value={settings.email || ''} onChange={F('email')} /></div>
            </div>
            <div><label className="label">VAT Number</label><input className="input" value={settings.vat_number || ''} onChange={F('vat_number')} /></div>
          </div>
        </div>

        {/* Logo & Branding */}
        <div className="card">
          <div className="card-header"><span className="text-sm font-medium text-zinc-300">Logo & Branding</span></div>
          <div className="card-body space-y-3">
            <p className="text-xs text-zinc-500">Your logo shows at the top-centre of the app. A wide PNG with a transparent background works best.</p>
            <div className="flex items-center gap-4">
              <div className="h-16 w-52 rounded-lg border border-zinc-700 bg-zinc-900 flex items-center justify-center overflow-hidden">
                {settings.logo_data
                  ? <img src={settings.logo_data} alt="Logo preview" className="max-h-14 max-w-48 object-contain" />
                  : <span className="text-xs text-zinc-600">No logo yet</span>}
              </div>
              <div className="flex flex-col gap-2">
                <label className="btn-secondary text-xs py-1.5 px-3 cursor-pointer text-center">
                  Upload logo
                  <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                </label>
                {settings.logo_data && (
                  <button onClick={() => setSettings(s => ({ ...s, logo_data: null }))} className="btn-ghost text-xs py-1.5 px-3 text-red-400">Remove</button>
                )}
              </div>
            </div>
            <p className="text-xs text-zinc-600">Remember to click <span className="text-zinc-400">Save Changes</span> after uploading.</p>
          </div>
        </div>

        {/* Rates */}
        <div className="card">
          <div className="card-header"><span className="text-sm font-medium text-zinc-300">Rates & Pricing</span></div>
          <div className="card-body space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Default Labour Rate (£/hr)</label>
                <input type="number" step="0.5" className="input" value={settings.labour_rate || ''} onChange={F('labour_rate')} />
              </div>
              <div>
                <label className="label">VAT Rate (%)</label>
                <input type="number" step="0.5" className="input" value={settings.vat_rate || ''} onChange={F('vat_rate')} />
              </div>
            </div>
          </div>
        </div>

        {/* Opening Hours */}
        <div className="card">
          <div className="card-header"><span className="text-sm font-medium text-zinc-300">Opening Hours</span></div>
          <div className="card-body space-y-2">
            <p className="text-xs text-zinc-500 mb-1">Sets which days count as working days on the calendar — technicians show as “in” on open days unless they've booked time off.</p>
            {DAYS_OH.map(([key, label]) => {
              const d = oh[key] || DEFAULT_OH[key]
              return (
                <div key={key} className="flex items-center gap-3">
                  <label className="flex items-center gap-2 w-32 cursor-pointer">
                    <input type="checkbox" checked={d.open} onChange={e => setOH(key, { open: e.target.checked })} className="accent-[#F4A523] w-4 h-4" />
                    <span className={d.open ? 'text-zinc-200 text-sm' : 'text-zinc-500 text-sm'}>{label}</span>
                  </label>
                  {d.open ? (
                    <div className="flex items-center gap-2">
                      <input type="time" className="input py-1.5 w-28" value={d.from} onChange={e => setOH(key, { from: e.target.value })} />
                      <span className="text-zinc-600 text-sm">to</span>
                      <input type="time" className="input py-1.5 w-28" value={d.to} onChange={e => setOH(key, { to: e.target.value })} />
                    </div>
                  ) : (
                    <span className="text-sm text-zinc-600">Closed</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Invoice numbering */}
        <div className="card">
          <div className="card-header"><span className="text-sm font-medium text-zinc-300">Invoice & Quote Numbering</span></div>
          <div className="card-body space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Invoice Prefix</label>
                <input className="input font-mono" value={settings.invoice_prefix || ''} onChange={F('invoice_prefix')} />
              </div>
              <div>
                <label className="label">Next Invoice Number</label>
                <input type="number" className="input font-mono" value={settings.invoice_next || ''} onChange={F('invoice_next')} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Quote Prefix</label>
                <input className="input font-mono" value={settings.quote_prefix || ''} onChange={F('quote_prefix')} />
              </div>
              <div>
                <label className="label">Next Quote Number</label>
                <input type="number" className="input font-mono" value={settings.quote_next || ''} onChange={F('quote_next')} />
              </div>
            </div>
            <div className="p-3 bg-zinc-800/50 rounded-lg text-xs text-zinc-400">
              Preview: <span className="font-mono text-zinc-200">{settings.invoice_prefix}-{settings.invoice_next}</span>
            </div>
          </div>
        </div>

        {/* App info */}
        <div className="card">
          <div className="card-header"><span className="text-sm font-medium text-zinc-300">App Info</span></div>
          <div className="card-body space-y-2 text-sm text-zinc-400">
            <div className="flex justify-between"><span>Version</span><span className="text-zinc-300">1.0.0</span></div>
            <div className="flex justify-between"><span>Database</span><span className="text-zinc-300">SQLite (local)</span></div>
            <div className="flex justify-between"><span>Stack</span><span className="text-zinc-300">Electron + React + TypeScript</span></div>
          </div>
        </div>
      </div>
    </div>
  )
}

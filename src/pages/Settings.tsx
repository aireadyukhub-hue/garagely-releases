import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Save, CheckCircle, Download, Plus, Trash2, Send, Bell, BadgePoundSterling } from 'lucide-react'
import api from '@/lib/api'
import { Settings as SettingsType, BookingReminderRule } from '@/types'

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
  const [rules, setRules] = useState<BookingReminderRule[]>([])
  const [rulesLoading, setRulesLoading] = useState(true)
  const [testingRule, setTestingRule] = useState<number | null>(null)

  useEffect(() => {
    api.getSettings().then(d => {
      const s = (d as SettingsType) || {}
      if (!(s as { opening_hours?: OpeningHours }).opening_hours) {
        (s as { opening_hours?: OpeningHours }).opening_hours = DEFAULT_OH
      }
      setSettings(s)
    })
    loadRules()
  }, [])

  const loadRules = () =>
    api.getReminderRules().then(d => { setRules(d as BookingReminderRule[]); setRulesLoading(false) })

  const addRule = async () => {
    await api.createReminderRule({ days_before: 3, active: true, subject: '', message: '' })
    await loadRules()
  }
  const patchRule = (id: number, patch: Partial<BookingReminderRule>) =>
    setRules(rs => rs.map(r => r.id === id ? { ...r, ...patch } : r))
  const saveRule = async (rule: BookingReminderRule) => {
    await api.updateReminderRule(rule.id, {
      days_before: rule.days_before, active: rule.active, subject: rule.subject, message: rule.message,
    })
  }
  const removeRule = async (id: number) => {
    if (!confirm('Remove this reminder rule?')) return
    await api.deleteReminderRule(id)
    await loadRules()
  }
  const sendTest = async (id: number) => {
    setTestingRule(id)
    try {
      await api.sendTestReminder(id)
      alert(`Test reminder sent to ${settings.email || 'your business email'}.`)
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setTestingRule(null)
    }
  }

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

  const NUMERIC = ['vat_rate', 'labour_rate', 'invoice_next', 'quote_next', 'reminder_lead_days', 'default_deposit_value']
  const F = (field: keyof SettingsType) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setSettings(s => ({ ...s, [field]: NUMERIC.includes(field) ? Number(e.target.value) : e.target.value }))
  // Text-area / select handler (no numeric coercion).
  const T = (field: keyof SettingsType) => (e: React.ChangeEvent<HTMLTextAreaElement | HTMLSelectElement>) =>
    setSettings(s => ({ ...s, [field]: e.target.value }))
  const ACCENT_PRESETS = ['#1F6FEB', '#F4A523', '#16A34A', '#DC2626', '#9333EA', '#0EA5E9', '#EC4899', '#F97316']

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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

            <div className="pt-3 border-t border-zinc-800">
              <label className="label">Accent colour</label>
              <p className="text-xs text-zinc-500 mb-2">Used for buttons and the active menu item across the app.</p>
              <div className="flex items-center gap-2 flex-wrap">
                {ACCENT_PRESETS.map(c => (
                  <button key={c} onClick={() => setSettings(s => ({ ...s, accent_color: c }))}
                    className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
                    style={{ background: c, borderColor: (settings.accent_color || '#1F6FEB') === c ? '#fff' : 'transparent' }}
                    title={c} />
                ))}
                <input type="color" value={settings.accent_color || '#1F6FEB'}
                  onChange={e => setSettings(s => ({ ...s, accent_color: e.target.value }))}
                  className="w-9 h-9 rounded-lg bg-transparent border border-zinc-700 cursor-pointer" title="Custom colour" />
              </div>
            </div>

            <div className="pt-3 border-t border-zinc-800">
              <label className="label">Interface density</label>
              <select className="select max-w-xs" value={settings.ui_density || 'comfortable'} onChange={T('ui_density')}>
                <option value="comfortable">Comfortable (default)</option>
                <option value="compact">Compact (tighter spacing)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Rates */}
        <div className="card">
          <div className="card-header"><span className="text-sm font-medium text-zinc-300">Rates & Pricing</span></div>
          <div className="card-body space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

        {/* Technician Mode */}
        <div className="card">
          <div className="card-header"><span className="text-sm font-medium text-zinc-300">Technician Mode</span></div>
          <div className="card-body space-y-3">
            <p className="text-xs text-zinc-500">
              A simplified view for shared workshop devices — technicians only see Calendar,
              Job Sheets, Customers, Vehicles and Inspections, no pricing, reports or settings.
              Turn it on from the sidebar on that device. Set a PIN here so only you can switch
              it back off.
            </p>
            <div className="max-w-xs">
              <label className="label">Technician Mode PIN</label>
              <input
                type="text"
                inputMode="numeric"
                className="input"
                placeholder="e.g. 4821 (leave blank to disable)"
                value={settings.tech_pin || ''}
                onChange={F('tech_pin')}
              />
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Invoice Prefix</label>
                <input className="input font-mono" value={settings.invoice_prefix || ''} onChange={F('invoice_prefix')} />
              </div>
              <div>
                <label className="label">Next Invoice Number</label>
                <input type="number" className="input font-mono" value={settings.invoice_next || ''} onChange={F('invoice_next')} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

        {/* Business defaults */}
        <div className="card">
          <div className="card-header"><span className="text-sm font-medium text-zinc-300">Business Defaults</span></div>
          <div className="card-body space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Currency</label>
                <select className="select" value={settings.currency || 'GBP'} onChange={T('currency')}>
                  <option value="GBP">£ GBP</option>
                  <option value="EUR">€ EUR</option>
                  <option value="USD">$ USD</option>
                </select>
              </div>
              <div>
                <label className="label">MOT / service reminder lead time (days)</label>
                <input type="number" className="input" value={settings.reminder_lead_days ?? 30} onChange={F('reminder_lead_days')} />
              </div>
            </div>
            <div>
              <label className="label">Default payment terms</label>
              <input className="input" value={settings.payment_terms || ''} onChange={F('payment_terms')} placeholder="e.g. Payment due within 14 days of invoice" />
            </div>
            <div>
              <label className="label">Bank details (shown on invoices)</label>
              <textarea className="textarea" rows={3} value={settings.bank_details || ''} onChange={T('bank_details')} placeholder={'Sort code: 00-00-00\nAccount: 00000000\nName: …'} />
            </div>
          </div>
        </div>

        {/* Booking reminders */}
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-300 flex items-center gap-2"><Bell className="w-4 h-4" /> Booking Reminders</span>
            <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-400">
              <input type="checkbox" checked={settings.booking_reminders_enabled ?? true}
                onChange={e => setSettings(s => ({ ...s, booking_reminders_enabled: e.target.checked }))}
                className="accent-[#F4A523] w-4 h-4" />
              Enabled
            </label>
          </div>
          <div className="card-body space-y-3">
            <p className="text-xs text-zinc-500">
              Automatic emails sent to the customer ahead of a booked appointment — set as
              many rules as you like (e.g. one 10 days before, another 3 days before). Sent
              once per booking per rule, every day, by the backend — no need to click anything.
              Leave subject/message blank on a rule to use the default wording.
            </p>
            {rulesLoading ? (
              <p className="text-xs text-zinc-600">Loading…</p>
            ) : (
              <div className="space-y-3">
                {rules.map(rule => (
                  <div key={rule.id} className="p-3 rounded-lg border border-zinc-800 bg-zinc-900/40 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-400 shrink-0">
                        <input type="checkbox" checked={rule.active}
                          onChange={e => { patchRule(rule.id, { active: e.target.checked }); saveRule({ ...rule, active: e.target.checked }) }}
                          className="accent-[#F4A523] w-4 h-4" />
                        Active
                      </label>
                      <input type="number" min={0} max={60} className="input py-1.5 w-20 text-center"
                        value={rule.days_before}
                        onChange={e => patchRule(rule.id, { days_before: Number(e.target.value) })}
                        onBlur={() => saveRule(rule)} />
                      <span className="text-xs text-zinc-500">days before the booking</span>
                      <div className="ml-auto flex items-center gap-1">
                        <button onClick={() => sendTest(rule.id)} disabled={testingRule === rule.id}
                          className="btn-ghost text-xs py-1 px-2 text-blue-400" title="Send a preview to your business email">
                          <Send className="w-3.5 h-3.5" /> {testingRule === rule.id ? 'Sending…' : 'Test'}
                        </button>
                        <button onClick={() => removeRule(rule.id)} className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800" title="Remove">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <input className="input py-1.5 text-xs" placeholder="Custom subject (optional — default: your booking reminder)"
                      value={rule.subject || ''} onChange={e => patchRule(rule.id, { subject: e.target.value })} onBlur={() => saveRule(rule)} />
                    <textarea className="textarea text-xs" rows={2} placeholder="Custom message (optional — default template mentions the date, time & vehicle)"
                      value={rule.message || ''} onChange={e => patchRule(rule.id, { message: e.target.value })} onBlur={() => saveRule(rule)} />
                  </div>
                ))}
                {rules.length === 0 && <p className="text-xs text-zinc-600">No reminder rules yet.</p>}
                <button onClick={addRule} className="btn-secondary text-xs py-1.5 px-3"><Plus className="w-3.5 h-3.5" /> Add reminder rule</button>
              </div>
            )}
          </div>
        </div>

        {/* Booking deposits */}
        <div className="card">
          <div className="card-header"><span className="text-sm font-medium text-zinc-300 flex items-center gap-2"><BadgePoundSterling className="w-4 h-4" /> Booking Deposits</span></div>
          <div className="card-body space-y-3">
            <p className="text-xs text-zinc-500">
              Default used when a new preset job is created. Each preset job in{' '}
              <Link to="/preset-jobs" className="text-blue-400 hover:text-blue-300">Preset Jobs</Link>{' '}
              can override this — e.g. a flat £50 to lock in the diary for most jobs, but 20% for
              bigger work.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Default deposit type</label>
                <select className="select" value={settings.default_deposit_type || 'fixed'} onChange={T('default_deposit_type')}>
                  <option value="fixed">Fixed amount (£)</option>
                  <option value="percent">Percentage of job total</option>
                </select>
              </div>
              <div>
                <label className="label">Default deposit value</label>
                <input type="number" step="0.5" className="input" value={settings.default_deposit_value ?? 0} onChange={F('default_deposit_value')}
                  placeholder={settings.default_deposit_type === 'percent' ? 'e.g. 20' : 'e.g. 50'} />
              </div>
            </div>
          </div>
        </div>

        {/* Documents & templates */}
        <div className="card">
          <div className="card-header"><span className="text-sm font-medium text-zinc-300">Documents &amp; Templates</span></div>
          <div className="card-body space-y-4">
            <p className="text-xs text-zinc-500">These fill in automatically on new quotes, invoices and printed job sheets — saving you re-typing the same lines.</p>
            <div>
              <label className="label">Default quote notes</label>
              <textarea className="textarea" rows={2} value={settings.quote_notes || ''} onChange={T('quote_notes')} placeholder="Prefilled in the Notes box on every new quote" />
            </div>
            <div>
              <label className="label">Default invoice notes</label>
              <textarea className="textarea" rows={2} value={settings.invoice_notes || ''} onChange={T('invoice_notes')} placeholder="Prefilled in the Notes box on every new invoice" />
            </div>
            <div>
              <label className="label">Terms &amp; conditions</label>
              <textarea className="textarea" rows={3} value={settings.terms || ''} onChange={T('terms')} placeholder="Printed at the foot of quotes and invoices" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Invoice / quote footer</label>
                <input className="input" value={settings.invoice_footer || ''} onChange={F('invoice_footer')} placeholder="e.g. Thank you for your business" />
              </div>
              <div>
                <label className="label">Job sheet footer</label>
                <input className="input" value={settings.jobsheet_footer || ''} onChange={F('jobsheet_footer')} placeholder="e.g. All work guaranteed for 12 months" />
              </div>
            </div>
          </div>
        </div>

        {/* Your data */}
        <div className="card">
          <div className="card-header"><span className="text-sm font-medium text-zinc-300">Your Data</span></div>
          <div className="card-body flex items-center justify-between gap-4">
            <p className="text-xs text-zinc-500">
              Moving from Setmore, Square or another system? Import your customers,
              appointment history and vehicles from their export files.
            </p>
            <Link to="/import" className="btn-secondary shrink-0"><Download className="w-4 h-4" /> Import Data</Link>
          </div>
        </div>

        {/* App info */}
        <div className="card">
          <div className="card-header"><span className="text-sm font-medium text-zinc-300">App Info</span></div>
          <div className="card-body space-y-2 text-sm text-zinc-400">
            <div className="flex justify-between"><span>Database</span><span className="text-zinc-300">Cloud (Supabase) — syncs across desktop &amp; web</span></div>
            <div className="flex justify-between"><span>Stack</span><span className="text-zinc-300">React + TypeScript</span></div>
          </div>
        </div>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Plus, ShieldCheck, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'
import api from '@/lib/api'
import { cn, formatDate } from '@/lib/utils'

type LookupResult = Awaited<ReturnType<typeof api.lookupVehicle>>
type GoldResult = Awaited<ReturnType<typeof api.goldCheck>>

// Dashboard widget: free reg lookup (DVSA) with a one-click "Add to Vehicles",
// plus an upsell button for the paid Gold Check (VDGL VDI Check — finance,
// write-off, stolen, mileage). Gold Check shows a friendly "not set up yet"
// state until VDGL_API_KEY / VDGL_BASE_URL are configured on the Worker.
export default function RegCheckCard() {
  const navigate = useNavigate()
  const [reg, setReg] = useState('')
  const [looking, setLooking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<LookupResult | null>(null)
  const [showHistory, setShowHistory] = useState(false)

  const [goldLoading, setGoldLoading] = useState(false)
  const [goldError, setGoldError] = useState<string | null>(null)
  const [goldResult, setGoldResult] = useState<GoldResult | null>(null)

  const runLookup = async () => {
    const value = reg.trim()
    if (!value) return
    setLooking(true); setError(null); setResult(null)
    setGoldResult(null); setGoldError(null)
    try {
      const v = await api.lookupVehicle(value)
      setResult(v)
    } catch (e) {
      setError((e as Error).message || 'Lookup failed')
    } finally {
      setLooking(false)
    }
  }

  const runGoldCheck = async () => {
    if (!result) return
    setGoldLoading(true); setGoldError(null)
    try {
      const g = await api.goldCheck(result.registration || reg)
      setGoldResult(g)
    } catch (e) {
      setGoldError((e as Error).message || 'Gold Check failed')
    } finally {
      setGoldLoading(false)
    }
  }

  const addToVehicles = () => {
    if (!result) return
    navigate('/vehicles', { state: { prefillVehicle: result } })
  }

  return (
    <div className="card mb-4">
      <div className="card-header">
        <span className="text-sm font-medium text-zinc-200">Reg Check</span>
      </div>
      <div className="p-4 space-y-4">
        <div className="flex gap-2">
          <input
            className="input uppercase flex-1"
            placeholder="Enter registration e.g. BD21 XYZ"
            value={reg}
            onChange={e => setReg(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && runLookup()}
          />
          <button type="button" onClick={runLookup} disabled={looking || !reg.trim()} className="btn-primary whitespace-nowrap">
            <Search className="w-4 h-4" /> {looking ? 'Checking…' : 'Check'}
          </button>
        </div>

        {error && <p className="text-xs text-amber-400">{error}</p>}

        {result && (
          <div className="border border-zinc-800 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-zinc-800/30">
              <div>
                <p className="font-mono font-semibold text-zinc-100 text-sm tracking-wider">{result.registration}</p>
                <p className="text-xs text-zinc-400">{[result.year, result.make, result.model].filter(Boolean).join(' ')}</p>
              </div>
              <button onClick={addToVehicles} className="btn-secondary text-xs">
                <Plus className="w-3.5 h-3.5" /> Add car
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-4 py-3 text-xs">
              <Field label="Colour" value={result.colour} />
              <Field label="Fuel" value={result.fuel_type} />
              <Field label="Engine" value={result.engine_size ? `${result.engine_size}cc` : ''} />
              <Field label="Mileage" value={result.mileage ? `${result.mileage.toLocaleString()} mi` : ''} />
              <Field label="MOT Due" value={result.mot_due ? formatDate(result.mot_due) : ''} />
            </div>

            {result.mot_history?.length > 0 && (
              <div className="border-t border-zinc-800">
                <button
                  onClick={() => setShowHistory(s => !s)}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  <span>MOT history ({result.mot_history.length})</span>
                  {showHistory ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
                {showHistory && (
                  <div className="px-4 pb-3 space-y-2">
                    {result.mot_history.map((m, i) => (
                      <div key={i} className="text-xs border-b border-zinc-800/50 last:border-0 pb-2 last:pb-0">
                        <div className="flex items-center justify-between text-zinc-300">
                          <span>{formatDate(m.date)}</span>
                          <span className={cn('font-medium', /pass/i.test(m.result) ? 'text-green-400' : 'text-red-400')}>
                            {m.result}
                          </span>
                        </div>
                        {m.defects?.length > 0 && (
                          <ul className="mt-1 space-y-0.5">
                            {m.defects.map((d, j) => (
                              <li key={j} className={cn('flex items-start gap-1', d.dangerous ? 'text-red-400' : 'text-zinc-500')}>
                                {d.dangerous && <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />}
                                <span>{d.text}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="border-t border-zinc-800 px-4 py-3">
              {!goldResult ? (
                <button onClick={runGoldCheck} disabled={goldLoading} className="btn-secondary text-xs w-full sm:w-auto">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {goldLoading ? 'Running Gold Check…' : 'Run Gold Check — £5 (finance, write-off & stolen check)'}
                </button>
              ) : (
                <div className="text-xs space-y-1.5">
                  <p className="text-zinc-300 font-medium mb-1.5">Gold Check results</p>
                  <GoldRow
                    label="Outstanding finance"
                    bad={goldResult.finance_outstanding}
                    detail={goldResult.finance_company || goldResult.finance_agreement_type || undefined}
                  />
                  <GoldRow
                    label="Written off"
                    bad={goldResult.written_off}
                    detail={[goldResult.write_off_category, goldResult.write_off_insurer].filter(Boolean).join(' · ') || undefined}
                  />
                  <GoldRow label="Stolen" bad={goldResult.stolen} />
                  <GoldRow label="Scrapped" bad={goldResult.scrapped} />
                  <GoldRow label="Mileage anomaly" bad={goldResult.mileage_anomaly} />
                  {goldResult.previous_keepers != null && (
                    <p className="text-zinc-500">Previous keepers: {goldResult.previous_keepers}</p>
                  )}
                </div>
              )}
              {goldError && <p className="text-xs text-amber-400 mt-2">{goldError}</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <p className="text-zinc-500 uppercase tracking-wide text-[10px] font-medium">{label}</p>
      <p className="text-zinc-200">{value || '—'}</p>
    </div>
  )
}

function GoldRow({ label, bad, detail }: { label: string; bad: boolean; detail?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-zinc-400">{label}</span>
      <span className={cn('font-medium', bad ? 'text-red-400' : 'text-green-400')}>
        {bad ? 'Yes' : 'Clear'}{bad && detail ? ` · ${detail}` : ''}
      </span>
    </div>
  )
}

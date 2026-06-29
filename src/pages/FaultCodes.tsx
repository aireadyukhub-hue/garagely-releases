import { useMemo, useState } from 'react'
import { Search, AlertTriangle, Wrench, Bug } from 'lucide-react'
import { FAULT_CODES, Severity } from '@/lib/faultCodes'
import { cn } from '@/lib/utils'

const SEV: Record<Severity, { label: string; badge: string }> = {
  low:    { label: 'Low',    badge: 'bg-green-500/15 text-green-400 border-green-500/30' },
  medium: { label: 'Medium', badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  high:   { label: 'High',   badge: 'bg-red-500/15 text-red-400 border-red-500/30' },
}

// Optional make filter (cosmetic for now — generic OBD-II codes mean the same on
// every make; manufacturer-specific P1xxx lookups are a planned addition).
const MAKES = ['Any', 'VW / Audi', 'BMW', 'Ford', 'Vauxhall', 'Mercedes', 'Toyota', 'Nissan', 'Peugeot/Citroën']

export default function FaultCodes() {
  const [q, setQ] = useState('')
  const [make, setMake] = useState('Any')

  const results = useMemo(() => {
    const s = q.trim().toLowerCase().replace(/\s+/g, '')
    if (!s) return FAULT_CODES.slice(0, 8) // show common ones by default
    return FAULT_CODES.filter(c =>
      c.code.toLowerCase().includes(s) || c.title.toLowerCase().replace(/\s+/g, '').includes(s),
    )
  }, [q])

  return (
    <div className="pt-2">
      <div className="page-header">
        <div>
          <h1 className="page-title">Fault Codes</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Look up an OBD fault code — what it means, common causes and fixes.</p>
        </div>
      </div>

      <div className="card mb-5">
        <div className="card-body space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input className="input pl-9 font-mono uppercase" placeholder="Enter a code, e.g. P0420  (or a keyword like 'misfire')"
              value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-zinc-500">Make:</span>
            {MAKES.map(m => (
              <button key={m} onClick={() => setMake(m)}
                className={cn('text-xs px-2.5 py-1 rounded-lg border transition-colors',
                  make === m ? 'bg-[#F4A523]/15 border-[#F4A523]/40 text-[#F4A523]' : 'border-zinc-700 text-zinc-400 hover:text-zinc-200')}>
                {m}
              </button>
            ))}
          </div>
          {make !== 'Any' && (
            <p className="text-[11px] text-zinc-600">Showing generic OBD-II codes (same meaning on every make). {make}-specific codes are coming.</p>
          )}
        </div>
      </div>

      {q.trim() && results.length === 0 ? (
        <div className="card">
          <div className="py-12 text-center text-zinc-500">
            <Bug className="w-8 h-8 mx-auto mb-3 text-zinc-600" />
            <p className="text-sm">No match for “{q}” in the current set.</p>
            <p className="text-xs mt-1">This is a starter library of the most common codes — the full database is on the way.</p>
          </div>
        </div>
      ) : (
        <>
          {!q.trim() && <p className="text-xs text-zinc-500 mb-3">Common codes — start typing to search the rest.</p>}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {results.map(c => (
              <div key={c.code} className="card">
                <div className="card-header flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-base font-bold text-[#F4A523]">{c.code}</span>
                    <span className={cn('status-badge', SEV[c.severity].badge)}>{SEV[c.severity].label}</span>
                  </div>
                </div>
                <div className="card-body space-y-3">
                  <p className="text-sm text-zinc-200 font-medium">{c.title}</p>
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> Common causes
                    </div>
                    <ul className="list-disc pl-5 text-sm text-zinc-300 space-y-0.5">
                      {c.causes.map((x, i) => <li key={i}>{x}</li>)}
                    </ul>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1">
                      <Wrench className="w-3.5 h-3.5 text-blue-400" /> Common fixes
                    </div>
                    <ul className="list-disc pl-5 text-sm text-zinc-300 space-y-0.5">
                      {c.fixes.map((x, i) => <li key={i}>{x}</li>)}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <p className="text-[11px] text-zinc-600 mt-6">
        Guidance only — always confirm with live data and proper diagnosis. Starter library of common UK petrol &amp; diesel codes; full database planned.
      </p>
    </div>
  )
}

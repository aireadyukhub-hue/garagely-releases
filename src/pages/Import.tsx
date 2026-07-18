// Import wizard — bring customers & appointments in from Setmore, Square,
// Google Contacts or any CSV/XLS export. Steps: files → mapping → options →
// run → report.

import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Upload, FileSpreadsheet, Trash2, ArrowRight, ArrowLeft, CheckCircle2,
  AlertTriangle, Car, Users, CalendarDays, Loader2, Download, PartyPopper,
} from 'lucide-react'
import { parseFile, type ParsedTable } from '@/lib/import/parse'
import {
  autoMap, detectKind, runImport, CUSTOMER_FIELDS, APPOINTMENT_FIELDS,
  FIELD_LABELS, type ImportReport, type ImportProgress,
} from '@/lib/import/engine'
import { clearCache } from '@/lib/cache'

interface LoadedFile {
  table: ParsedTable
  kind: 'customers' | 'appointments'
  mapping: string[]
}

type Step = 'files' | 'mapping' | 'options' | 'running' | 'report'

const SOURCES = [
  { id: 'setmore', name: 'Setmore', hint: 'Customers → Options → Export Customers (CSV by email) · Settings → Booking Page → Reports → Export as .XLS (do ≤3-month chunks and add every file here)' },
  { id: 'square', name: 'Square Appointments', hint: 'Dashboard → Customers → Import/Export → Export Customers · Appointments → Settings → History → Export' },
  { id: 'google', name: 'Google Contacts', hint: 'contacts.google.com → Export → Google CSV' },
  { id: 'other', name: 'Other / any CSV or Excel', hint: 'Any file with a header row works — you can fix the column matching in the next step' },
]

export default function Import() {
  const [step, setStep] = useState<Step>('files')
  const [source, setSource] = useState('setmore')
  const [files, setFiles] = useState<LoadedFile[]>([])
  const [parseError, setParseError] = useState('')
  const [mergeDuplicates, setMergeDuplicates] = useState(true)
  const [vrmLookup, setVrmLookup] = useState(true)
  const [dayFirstDates, setDayFirstDates] = useState(true)
  const [progress, setProgress] = useState<ImportProgress | null>(null)
  const [report, setReport] = useState<ImportReport | null>(null)
  const cancelRef = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // ── file handling ──────────────────────────────────────────────────────────
  const addFiles = async (list: FileList | null) => {
    if (!list) return
    setParseError('')
    for (const f of Array.from(list)) {
      try {
        const table = await parseFile(f)
        const kind = detectKind(table.headers)
        setFiles((prev) => [...prev, { table, kind, mapping: autoMap(table.headers, kind) }])
      } catch (e) {
        setParseError(`${f.name}: ${e instanceof Error ? e.message : 'could not read file'}`)
      }
    }
    if (inputRef.current) inputRef.current.value = ''
  }

  const setKind = (i: number, kind: 'customers' | 'appointments') =>
    setFiles((prev) => prev.map((f, j) => (j === i ? { ...f, kind, mapping: autoMap(f.table.headers, kind) } : f)))

  const setMapping = (fi: number, col: number, field: string) =>
    setFiles((prev) => prev.map((f, j) => {
      if (j !== fi) return f
      const mapping = [...f.mapping]
      // a field (other than notes/ignore) can only be used once per file
      if (field !== 'ignore' && field !== 'notes') {
        for (let k = 0; k < mapping.length; k++) if (mapping[k] === field) mapping[k] = 'ignore'
      }
      mapping[col] = field
      return { ...f, mapping }
    }))

  // ── run ────────────────────────────────────────────────────────────────────
  const start = async () => {
    setStep('running')
    cancelRef.current = false
    setProgress({ phase: 'customers', done: 0, total: 0, message: 'Starting…' })
    try {
      const rep = await runImport(
        files.map((f) => ({ table: f.table, kind: f.kind, mapping: f.mapping })),
        {
          mergeDuplicates, vrmLookup, dayFirstDates, defaultDurationMins: 60,
          onProgress: setProgress,
          shouldCancel: () => cancelRef.current,
        },
      )
      clearCache() // bust read cache so lists show the new data immediately
      setReport(rep)
      setStep('report')
    } catch (e) {
      setReport({
        customersCreated: 0, customersMerged: 0, bookingsCreated: 0, bookingsSkipped: 0,
        vehiclesCreated: 0, vehiclesEnriched: 0, vrmLookupFailed: 0,
        errors: [e instanceof Error ? e.message : 'Import failed'], skippedRows: [],
      })
      setStep('report')
    }
  }

  const downloadSkipped = () => {
    if (!report) return
    const lines = ['File,Row,Reason', ...report.skippedRows.map((s) => `"${s.file}",${s.row},"${s.reason.replace(/"/g, '""')}"`)]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'import-skipped-rows.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const kindIcon = (k: string) => (k === 'customers' ? <Users className="w-4 h-4" /> : <CalendarDays className="w-4 h-4" />)
  const fieldsFor = (k: string) => (k === 'customers' ? CUSTOMER_FIELDS : APPOINTMENT_FIELDS)
  const hasCustomerFile = files.some((f) => f.kind === 'customers')
  const hasApptFile = files.some((f) => f.kind === 'appointments')

  // ── UI ─────────────────────────────────────────────────────────────────────
  return (
    <div className="py-6 space-y-5">
      <div>
        <Link to="/settings" className="text-xs text-zinc-500 hover:text-zinc-300 inline-flex items-center gap-1 mb-2">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Settings
        </Link>
        <h1 className="page-title">Import Data</h1>
        <p className="text-zinc-400 text-sm mt-1">
          Move your customers and appointments in from Setmore, Square, Google Contacts or any spreadsheet.
          Vehicle regs found in your data are looked up automatically to build your vehicle records.
        </p>
      </div>

      {/* Step indicator */}
      {step !== 'report' && (
        <div className="flex items-center gap-2 text-xs">
          {(['files', 'mapping', 'options'] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              {i > 0 && <div className="w-6 h-px bg-zinc-700" />}
              <span className={
                step === s || (step === 'running' && s === 'options')
                  ? 'px-2.5 py-1 rounded-full bg-[var(--accent)] text-white font-medium'
                  : 'px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-400'
              }>
                {i + 1}. {s === 'files' ? 'Files' : s === 'mapping' ? 'Match columns' : 'Options'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── STEP 1: files ── */}
      {step === 'files' && (
        <div className="space-y-4">
          <div className="card">
            <div className="card-header"><h2 className="font-medium text-zinc-200">Where is your data coming from?</h2></div>
            <div className="card-body space-y-3">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                {SOURCES.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSource(s.id)}
                    className={
                      source === s.id
                        ? 'p-3 rounded-lg border border-[var(--accent)] bg-[var(--accent)]/10 text-left'
                        : 'p-3 rounded-lg border border-zinc-700 hover:border-zinc-500 text-left'
                    }
                  >
                    <div className="text-sm font-medium text-zinc-100">{s.name}</div>
                  </button>
                ))}
              </div>
              <p className="text-xs text-zinc-500 leading-relaxed">
                <span className="text-zinc-300 font-medium">How to export: </span>
                {SOURCES.find((s) => s.id === source)?.hint}
              </p>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><h2 className="font-medium text-zinc-200">Add your export files</h2></div>
            <div className="card-body space-y-3">
              <button
                onClick={() => inputRef.current?.click()}
                className="w-full border-2 border-dashed border-zinc-700 hover:border-[var(--accent)] rounded-xl p-8 flex flex-col items-center gap-2 text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                <Upload className="w-8 h-8" />
                <span className="text-sm">Click to add CSV or Excel files (you can add several)</span>
                <span className="text-xs text-zinc-600">.csv · .xls · .xlsx</span>
              </button>
              <input ref={inputRef} type="file" multiple accept=".csv,.tsv,.txt,.xls,.xlsx" className="hidden" onChange={(e) => addFiles(e.target.files)} />
              {parseError && <p className="text-red-400 text-sm flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" />{parseError}</p>}

              {files.length > 0 && (
                <div className="space-y-2">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center gap-3 bg-zinc-800/50 rounded-lg px-3 py-2">
                      <FileSpreadsheet className="w-5 h-5 text-[var(--accent)] shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-zinc-200 truncate">{f.table.fileName}</div>
                        <div className="text-xs text-zinc-500">{f.table.rows.length} rows · {f.table.headers.length} columns</div>
                      </div>
                      <select className="input !w-auto text-sm py-1" value={f.kind} onChange={(e) => setKind(i, e.target.value as 'customers' | 'appointments')}>
                        <option value="customers">Customers</option>
                        <option value="appointments">Appointments</option>
                      </select>
                      <button onClick={() => setFiles((p) => p.filter((_, j) => j !== i))} className="text-zinc-500 hover:text-red-400">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {files.length > 0 && !hasCustomerFile && (
                <p className="text-xs text-amber-400/90 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> No customer file added — customers will be created from the appointment rows instead (that works fine).
                </p>
              )}
              {files.length > 0 && !hasApptFile && (
                <p className="text-xs text-zinc-500">Tip: add your appointment history too — it fills your calendar and finds vehicle regs.</p>
              )}
            </div>
          </div>

          <div className="flex justify-end">
            <button className="btn-primary" disabled={files.length === 0} onClick={() => setStep('mapping')}>
              Next: match columns <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 2: mapping ── */}
      {step === 'mapping' && (
        <div className="space-y-4">
          {files.map((f, fi) => (
            <div key={fi} className="card">
              <div className="card-header flex items-center gap-2">
                {kindIcon(f.kind)}
                <h2 className="font-medium text-zinc-200">{f.table.fileName}</h2>
                <span className="text-xs text-zinc-500 ml-auto">{f.kind === 'customers' ? 'Customer list' : 'Appointments'} · first 3 rows shown</span>
              </div>
              <div className="card-body overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      {f.table.headers.map((h, ci) => (
                        <th key={ci} className="text-left p-2 align-top min-w-[150px]">
                          <div className="text-xs text-zinc-500 font-normal truncate mb-1" title={h}>{h || '(no header)'}</div>
                          <select
                            className="input text-xs py-1 w-full"
                            value={f.mapping[ci] ?? 'ignore'}
                            onChange={(e) => setMapping(fi, ci, e.target.value)}
                          >
                            {fieldsFor(f.kind).map((field) => (
                              <option key={field} value={field}>{FIELD_LABELS[field] ?? field}</option>
                            ))}
                          </select>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {f.table.rows.slice(0, 3).map((r, ri) => (
                      <tr key={ri} className="border-t border-zinc-800">
                        {f.table.headers.map((_, ci) => (
                          <td key={ci} className="p-2 text-zinc-400 text-xs truncate max-w-[200px]">{r[ci]}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {f.kind === 'appointments' && !f.mapping.includes('date') && !f.mapping.includes('datetime') && (
                  <p className="text-amber-400/90 text-xs mt-2 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" /> No date column matched — these rows will be skipped unless you pick one above.
                  </p>
                )}
              </div>
            </div>
          ))}

          <div className="flex justify-between">
            <button className="btn-secondary" onClick={() => setStep('files')}><ArrowLeft className="w-4 h-4" /> Back</button>
            <button className="btn-primary" onClick={() => setStep('options')}>Next: options <ArrowRight className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      {/* ── STEP 3: options ── */}
      {step === 'options' && (
        <div className="space-y-4">
          <div className="card">
            <div className="card-header"><h2 className="font-medium text-zinc-200">Import options</h2></div>
            <div className="card-body space-y-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" className="mt-1" checked={mergeDuplicates} onChange={(e) => setMergeDuplicates(e.target.checked)} />
                <span>
                  <span className="text-sm text-zinc-200 block">Merge duplicates</span>
                  <span className="text-xs text-zinc-500">If an imported customer matches an existing one (email, phone or name), fill in any blank details instead of creating a duplicate.</span>
                </span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" className="mt-1" checked={vrmLookup} onChange={(e) => setVrmLookup(e.target.checked)} />
                <span>
                  <span className="text-sm text-zinc-200 block flex items-center gap-1.5"><Car className="w-4 h-4 text-[var(--accent)]" /> Auto-build vehicle records (DVSA lookup)</span>
                  <span className="text-xs text-zinc-500">Regs found in your appointments (e.g. “MOT — AB12 CDE”) are looked up to create full vehicle records with make, model, fuel and MOT due date. Large imports take a few minutes.</span>
                </span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" className="mt-1" checked={dayFirstDates} onChange={(e) => setDayFirstDates(e.target.checked)} />
                <span>
                  <span className="text-sm text-zinc-200 block">Dates are day-first (UK format)</span>
                  <span className="text-xs text-zinc-500">01/02/2026 means 1 February. Untick only if your export uses American month-first dates.</span>
                </span>
              </label>
            </div>
          </div>

          <div className="card">
            <div className="card-body text-sm text-zinc-400">
              Ready to import <span className="text-zinc-200">{files.reduce((n, f) => n + f.table.rows.length, 0)} rows</span> from {files.length} file{files.length === 1 ? '' : 's'}.
              Re-running an import later is safe — existing bookings and customers are detected and skipped.
            </div>
          </div>

          <div className="flex justify-between">
            <button className="btn-secondary" onClick={() => setStep('mapping')}><ArrowLeft className="w-4 h-4" /> Back</button>
            <button className="btn-primary" onClick={start}><Upload className="w-4 h-4" /> Start import</button>
          </div>
        </div>
      )}

      {/* ── STEP 4: running ── */}
      {step === 'running' && progress && (
        <div className="card">
          <div className="card-body py-10 flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 text-[var(--accent)] animate-spin" />
            <div className="text-zinc-200 text-sm">{progress.message}</div>
            {progress.total > 0 && (
              <div className="w-full max-w-md">
                <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[var(--accent)] transition-all"
                    style={{ width: `${Math.round((progress.done / Math.max(progress.total, 1)) * 100)}%` }}
                  />
                </div>
                <div className="text-xs text-zinc-500 mt-1 text-center">{progress.done} / {progress.total}</div>
              </div>
            )}
            <button className="btn-secondary text-xs" onClick={() => { cancelRef.current = true }}>Cancel</button>
            <p className="text-xs text-zinc-600">Keep this tab open — vehicle lookups are rate-limited on purpose.</p>
          </div>
        </div>
      )}

      {/* ── STEP 5: report ── */}
      {step === 'report' && report && (
        <div className="space-y-4">
          <div className="card">
            <div className="card-body py-8 text-center space-y-1">
              {report.errors.length === 0 ? (
                <PartyPopper className="w-10 h-10 text-[var(--accent)] mx-auto mb-2" />
              ) : (
                <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto mb-2" />
              )}
              <h2 className="text-lg font-semibold text-zinc-100">
                {report.errors.length === 0 ? 'Import complete' : 'Import finished with some problems'}
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Customers added', value: report.customersCreated, icon: Users },
              { label: 'Matched & merged', value: report.customersMerged, icon: CheckCircle2 },
              { label: 'Appointments added', value: report.bookingsCreated, icon: CalendarDays },
              { label: 'Vehicles created', value: report.vehiclesCreated, icon: Car },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="card">
                <div className="card-body flex items-center gap-3">
                  <Icon className="w-5 h-5 text-[var(--accent)]" />
                  <div>
                    <div className="text-xl font-semibold text-zinc-100">{value}</div>
                    <div className="text-xs text-zinc-500">{label}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="card-body text-sm text-zinc-400 space-y-1.5">
              {report.vehiclesEnriched > 0 && <p>{report.vehiclesEnriched} vehicle{report.vehiclesEnriched === 1 ? '' : 's'} enriched with DVSA data (make, model, MOT due).</p>}
              {report.vrmLookupFailed > 0 && <p>{report.vrmLookupFailed} reg lookup{report.vrmLookupFailed === 1 ? '' : 's'} failed — created as reg-only records you can complete later.</p>}
              {report.bookingsSkipped > 0 && <p>{report.bookingsSkipped} appointment{report.bookingsSkipped === 1 ? '' : 's'} skipped (already imported).</p>}
              {report.skippedRows.length > 0 && (
                <p className="flex items-center gap-2">
                  {report.skippedRows.length} row{report.skippedRows.length === 1 ? '' : 's'} couldn’t be read.
                  <button onClick={downloadSkipped} className="text-[var(--accent)] hover:underline inline-flex items-center gap-1"><Download className="w-3.5 h-3.5" /> Download details</button>
                </p>
              )}
              {report.errors.map((e, i) => <p key={i} className="text-red-400">{e}</p>)}
              {report.errors.length === 0 && report.skippedRows.length === 0 && <p>No problems found.</p>}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link to="/customers" className="btn-primary"><Users className="w-4 h-4" /> View customers</Link>
            <Link to="/calendar" className="btn-secondary"><CalendarDays className="w-4 h-4" /> View calendar</Link>
            <Link to="/vehicles" className="btn-secondary"><Car className="w-4 h-4" /> View vehicles</Link>
            <button className="btn-secondary" onClick={() => { setFiles([]); setReport(null); setStep('files') }}>Import more</button>
          </div>
        </div>
      )}
    </div>
  )
}

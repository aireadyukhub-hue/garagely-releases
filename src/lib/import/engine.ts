// Import engine — takes parsed tables + a column mapping and writes customers,
// bookings and vehicles into Supabase. Used by the Import wizard page.
//
// Design notes:
//  • Everything runs client-side; inserts are batched and stamped with
//    garage_id (same pattern as lib/api.ts direct inserts).
//  • Duplicate customers are merged by email → phone → name+postcode.
//  • VRMs found in appointment text are enriched through the existing DVSA
//    lookup (api.lookupVehicle) with a throttle, falling back to stub records.

import { supabase, getGarageId } from '../supabase'
import api from '../api'
import { extractVrms, normaliseVrm } from './vrm'
import type { ParsedTable } from './parse'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>

// ── Target fields ────────────────────────────────────────────────────────────
export const CUSTOMER_FIELDS = [
  'first_name', 'last_name', 'full_name', 'email', 'phone', 'mobile',
  'address', 'address2', 'city', 'postcode', 'notes', 'vehicle_reg', 'ignore',
] as const

export const APPOINTMENT_FIELDS = [
  'date', 'start_time', 'datetime', 'end_time', 'end_datetime', 'duration_mins',
  'title', 'staff', 'customer_name', 'customer_first', 'customer_last',
  'email', 'phone', 'status', 'notes', 'price', 'vehicle_reg', 'ignore',
] as const

export type CustomerField = (typeof CUSTOMER_FIELDS)[number]
export type AppointmentField = (typeof APPOINTMENT_FIELDS)[number]

export const FIELD_LABELS: Record<string, string> = {
  first_name: 'First name', last_name: 'Last name', full_name: 'Full name (split automatically)',
  email: 'Email', phone: 'Phone', mobile: 'Mobile', address: 'Address', address2: 'Address line 2',
  city: 'City / town', postcode: 'Postcode', notes: 'Notes', vehicle_reg: 'Vehicle reg',
  date: 'Date', start_time: 'Start time', datetime: 'Date & time (combined)',
  end_time: 'End time', end_datetime: 'End date & time', duration_mins: 'Duration (minutes)',
  title: 'Service / title', staff: 'Staff member', customer_name: 'Customer name',
  customer_first: 'Customer first name', customer_last: 'Customer last name',
  status: 'Status', price: 'Price', ignore: '— Ignore this column —',
}

// ── Header auto-mapping ──────────────────────────────────────────────────────
// Synonyms are checked in order; first match wins. Keys are normalised headers
// (lowercase, alphanumeric only).
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

const CUSTOMER_SYNONYMS: Array<[CustomerField, string[]]> = [
  ['first_name', ['firstname', 'first', 'forename', 'givenname']],
  ['last_name', ['lastname', 'surname', 'familyname', 'last']],
  ['full_name', ['name', 'fullname', 'customername', 'customer', 'clientname', 'client', 'contactname']],
  ['email', ['email', 'emailaddress', 'emailid', 'mail']],
  ['mobile', ['mobile', 'mobilephone', 'mobileno', 'cell', 'cellphone', 'cellno']],
  ['phone', ['phone', 'phonenumber', 'phoneno', 'telephone', 'tel', 'landline', 'homephone', 'workphone', 'contactno', 'contactnumber']],
  ['address2', ['address2', 'addressline2', 'street2']],
  ['address', ['address', 'address1', 'addressline1', 'street', 'streetaddress']],
  ['city', ['city', 'town', 'suburb']],
  ['postcode', ['postcode', 'postalcode', 'zip', 'zipcode', 'postal']],
  ['vehicle_reg', ['reg', 'registration', 'vehiclereg', 'regno', 'vrm', 'numberplate', 'plate', 'licenseplate', 'licenceplate', 'vehicle']],
  ['notes', ['notes', 'comment', 'comments', 'additionalinfo', 'remarks', 'description']],
]

const APPOINTMENT_SYNONYMS: Array<[AppointmentField, string[]]> = [
  ['end_datetime', ['enddatetime', 'endsat', 'enddateandtime']],
  ['end_time', ['endtime', 'end', 'finishtime', 'until']],
  ['datetime', ['datetime', 'dateandtime', 'appointmentdatetime', 'startdatetime', 'bookingdatetime', 'starts', 'startsat']],
  ['date', ['date', 'appointmentdate', 'bookingdate', 'startdate', 'day', 'apptdate']],
  ['start_time', ['time', 'starttime', 'appointmenttime', 'bookingtime', 'start', 'appttime', 'slot']],
  ['duration_mins', ['duration', 'durationmins', 'durationminutes', 'length', 'mins', 'minutes']],
  ['title', ['service', 'servicename', 'services', 'event', 'eventname', 'class', 'classname', 'title', 'appointmenttype', 'type', 'reason', 'treatment', 'session']],
  ['staff', ['staff', 'staffname', 'staffmember', 'provider', 'teammember', 'employee', 'resource', 'technician', 'with']],
  ['customer_first', ['customerfirstname', 'clientfirstname', 'firstname']],
  ['customer_last', ['customerlastname', 'clientlastname', 'lastname', 'surname']],
  ['customer_name', ['customer', 'customername', 'client', 'clientname', 'name', 'fullname', 'attendee', 'bookedby', 'contact']],
  ['email', ['email', 'emailaddress', 'customeremail', 'clientemail']],
  ['phone', ['phone', 'phonenumber', 'mobile', 'telephone', 'tel', 'contactno', 'customerphone']],
  ['status', ['status', 'appointmentstatus', 'bookingstatus', 'state']],
  ['price', ['price', 'cost', 'amount', 'total', 'fee', 'revenue', 'paid']],
  ['vehicle_reg', ['reg', 'registration', 'vehiclereg', 'regno', 'vrm', 'numberplate', 'plate', 'vehicle']],
  ['notes', ['notes', 'comment', 'comments', 'label', 'labels', 'description', 'details', 'additionalinfo']],
]

export function autoMap(headers: string[], kind: 'customers' | 'appointments'): string[] {
  const table = kind === 'customers' ? CUSTOMER_SYNONYMS : APPOINTMENT_SYNONYMS
  const used = new Set<string>()
  const ID_COLS = new Set(['id', 'customerid', 'clientid', 'appointmentid', 'bookingid', 'staffid', 'serviceid', 'eventid', 'key', 'uuid'])
  return headers.map((h) => {
    const n = norm(h)
    if (!n || ID_COLS.has(n)) return 'ignore'
    for (const [field, syns] of table) {
      // exact match, or header begins with a reasonably long synonym
      // ("emaildaddress" → email). Deliberately NOT synonym-begins-with-header,
      // which caused "Address" → address2 and "Customer" → customer_first.
      if (syns.some((s) => n === s || (s.length >= 4 && n.startsWith(s)))) {
        // full_name/customer_name/notes may map from several columns; others once
        const reusable = field === 'notes'
        if (!reusable && used.has(field)) continue
        used.add(field)
        return field
      }
    }
    return 'ignore'
  })
}

/** Detect whether a parsed file looks like a customer list or appointments. */
export function detectKind(headers: string[]): 'customers' | 'appointments' {
  const n = headers.map(norm).join('|')
  const appt = ['service', 'appointment', 'staff', 'starttime', 'date', 'duration', 'provider', 'booking']
  const hits = appt.filter((k) => n.includes(k)).length
  return hits >= 2 ? 'appointments' : 'customers'
}

// ── Date/time parsing ────────────────────────────────────────────────────────
const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
}

/** Parse a date string into [y, m, d] or null. dayFirst controls 01/02/2026. */
export function parseDate(s: string, dayFirst = true): [number, number, number] | null {
  const t = s.trim()
  if (!t) return null
  // ISO 2026-01-31 (optionally with time attached)
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(t)
  if (m) return [+m[1], +m[2], +m[3]]
  // 31/01/2026, 1-31-26, 31.01.2026
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/.exec(t)
  if (m) {
    let a = +m[1], b = +m[2], y = +m[3]
    if (y < 100) y += 2000
    let d = dayFirst ? a : b
    let mo = dayFirst ? b : a
    if (mo > 12 && d <= 12) { const tmp = d; d = mo; mo = tmp } // impossible month → swap
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null
    return [y, mo, d]
  }
  // "31 Jan 2026" / "Jan 31, 2026" / "Sat, 31 Jan 2026"
  const words = t.replace(/,/g, ' ').split(/\s+/)
  let day = 0, mon = 0, year = 0
  for (const w of words) {
    const mm = MONTHS[w.slice(0, 3).toLowerCase()]
    if (mm && !mon) { mon = mm; continue }
    if (/^\d{4}$/.test(w)) { year = +w; continue }
    const dd = /^(\d{1,2})(st|nd|rd|th)?$/.exec(w)
    if (dd && !day) day = +dd[1]
  }
  if (day && mon && year) return [year, mon, day]
  return null
}

/** Parse a time out of a string (works on combined date+time strings too). */
export function parseTime(s: string): number | null {
  const t = s.trim().toLowerCase()
  if (!t) return null
  // scan all hh:mm candidates, take the first VALID one (skips "31.01" in
  // dotted dates), then bare "9am" style as a fallback
  const re = /(\d{1,2})[:.](\d{2})(?::\d{2})?\s*(am|pm)?/g
  let m: RegExpExecArray | null
  while ((m = re.exec(t))) {
    let h = +m[1]
    const mins = +m[2]
    const ap = m[3]
    if (ap === 'pm' && h < 12) h += 12
    if (ap === 'am' && h === 12) h = 0
    if (h <= 23 && mins <= 59) return h * 60 + mins
  }
  const bare = /\b(\d{1,2})\s*(am|pm)\b/.exec(t)
  if (bare) {
    let h = +bare[1]
    if (bare[2] === 'pm' && h < 12) h += 12
    if (bare[2] === 'am' && h === 12) h = 0
    if (h <= 23) return h * 60
  }
  return null
}

const pad = (n: number) => String(n).padStart(2, '0')
function isoLocal(y: number, mo: number, d: number, minutes: number): string {
  return `${y}-${pad(mo)}-${pad(d)}T${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}:00`
}

// ── Mapping application ──────────────────────────────────────────────────────
function applyMapping(table: ParsedTable, mapping: string[]): Row[] {
  return table.rows.map((r) => {
    const o: Row = {}
    mapping.forEach((field, i) => {
      if (field === 'ignore' || !field) return
      const v = (r[i] ?? '').trim()
      if (!v) return
      o[field] = o[field] ? `${o[field]} ${v}` : v // notes may accumulate
    })
    return o
  })
}

function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/)
  if (parts.length === 1) return { first: parts[0], last: '' }
  return { first: parts.slice(0, -1).join(' '), last: parts[parts.length - 1] }
}

const normEmail = (e?: string) => (e || '').trim().toLowerCase()
const normPhone = (p?: string) => {
  const d = (p || '').replace(/\D/g, '')
  return d.length >= 7 ? d.slice(-10) : ''
}
const nameKey = (f?: string, l?: string) =>
  `${(f || '').trim().toLowerCase()}|${(l || '').trim().toLowerCase()}`

// ── Progress reporting ───────────────────────────────────────────────────────
export interface ImportProgress {
  phase: 'customers' | 'bookings' | 'vehicles' | 'done'
  done: number
  total: number
  message: string
}

export interface ImportOptions {
  mergeDuplicates: boolean // fill blanks on matched customers
  vrmLookup: boolean // enrich via DVSA (throttled) vs stubs only
  dayFirstDates: boolean // 01/02 = 1 Feb (UK) vs 2 Jan (US)
  defaultDurationMins: number
  onProgress?: (p: ImportProgress) => void
  shouldCancel?: () => boolean
}

export interface ImportReport {
  customersCreated: number
  customersMerged: number
  bookingsCreated: number
  bookingsSkipped: number
  vehiclesCreated: number
  vehiclesEnriched: number
  vrmLookupFailed: number
  errors: string[]
  skippedRows: Array<{ file: string; row: number; reason: string }>
}

// ── Main entry ───────────────────────────────────────────────────────────────
export async function runImport(
  files: Array<{ table: ParsedTable; kind: 'customers' | 'appointments'; mapping: string[] }>,
  opts: ImportOptions,
): Promise<ImportReport> {
  const garage_id = await getGarageId()
  const report: ImportReport = {
    customersCreated: 0, customersMerged: 0, bookingsCreated: 0, bookingsSkipped: 0,
    vehiclesCreated: 0, vehiclesEnriched: 0, vrmLookupFailed: 0, errors: [], skippedRows: [],
  }
  const progress = (p: ImportProgress) => opts.onProgress?.(p)
  const cancelled = () => opts.shouldCancel?.() === true

  // ── Existing data for dedupe ───────────────────────────────────────────────
  const { data: existing, error: exErr } = await supabase
    .from('customers').select('id,first_name,last_name,email,phone,mobile,address,city,postcode,notes')
  if (exErr) throw new Error(exErr.message)

  const byEmail = new Map<string, Row>()
  const byPhone = new Map<string, Row>()
  const byName = new Map<string, Row>()
  const indexCustomer = (c: Row) => {
    const e = normEmail(c.email); if (e && !byEmail.has(e)) byEmail.set(e, c)
    for (const p of [normPhone(c.phone), normPhone(c.mobile)]) if (p && !byPhone.has(p)) byPhone.set(p, c)
    const nk = nameKey(c.first_name, c.last_name); if (nk !== '|' && !byName.has(nk)) byName.set(nk, c)
  }
  ;(existing || []).forEach(indexCustomer)

  const findMatch = (c: Row): Row | undefined => {
    const e = normEmail(c.email); if (e && byEmail.has(e)) return byEmail.get(e)
    for (const p of [normPhone(c.mobile), normPhone(c.phone)]) if (p && byPhone.has(p)) return byPhone.get(p)
    const nk = nameKey(c.first_name, c.last_name)
    if (nk !== '|' && c.first_name && c.last_name && byName.has(nk)) return byName.get(nk)
    return undefined
  }

  // ── Phase 1: customers ─────────────────────────────────────────────────────
  // Collect customer records from customer files AND appointment files (an
  // appointment row can introduce a customer we've never seen).
  interface PendingCustomer { data: Row; sourceKeys: string[] }
  const pending: PendingCustomer[] = []
  const keyToCustomer = new Map<string, Row>() // resolves appointment rows → customer

  const rememberKeys = (c: Row, cust: Row) => {
    const e = normEmail(c.email); if (e) keyToCustomer.set(`e:${e}`, cust)
    for (const p of [normPhone(c.phone), normPhone(c.mobile)]) if (p) keyToCustomer.set(`p:${p}`, cust)
    const nk = nameKey(c.first_name, c.last_name); if (nk !== '|') keyToCustomer.set(`n:${nk}`, cust)
  }

  const toCustomer = (o: Row): Row | null => {
    let first = o.first_name || o.customer_first || ''
    let last = o.last_name || o.customer_last || ''
    if (!first && (o.full_name || o.customer_name)) {
      const s = splitName(o.full_name || o.customer_name)
      first = s.first; last = s.last
    }
    if (!first && !o.email && !o.phone && !o.mobile) return null
    const addr = [o.address, o.address2].filter(Boolean).join(', ')
    return {
      first_name: first || '(unknown)', last_name: last || '',
      email: o.email || null, phone: o.phone || null, mobile: o.mobile || null,
      address: addr || null, city: o.city || null, postcode: o.postcode || null,
      notes: o.notes || null,
    }
  }

  // Track VRMs per customer key as we go (from any file).
  const vrmToCustomerKey = new Map<string, string>() // reg → dedupe key of owner
  const customerKeyOf = (c: Row) => {
    const e = normEmail(c.email); if (e) return `e:${e}`
    const p = normPhone(c.mobile) || normPhone(c.phone); if (p) return `p:${p}`
    return `n:${nameKey(c.first_name, c.last_name)}`
  }

  const allMapped: Array<{ file: string; kind: string; rows: Row[] }> = files.map((f) => ({
    file: f.table.fileName, kind: f.kind, rows: applyMapping(f.table, f.mapping),
  }))

  for (const f of allMapped) {
    f.rows.forEach((o, idx) => {
      // A junk appointment row (unreadable date, no contact details) shouldn't
      // create a customer from just a name fragment.
      if (f.kind === 'appointments' && !parseDate(o.datetime || o.date || '', opts.dayFirstDates) && !o.email && !o.phone) return
      const c = toCustomer(o)
      if (!c) {
        if (f.kind === 'customers') report.skippedRows.push({ file: f.file, row: idx + 2, reason: 'No name, email or phone' })
        return
      }
      const key = customerKeyOf(c)
      // collect explicit + free-text VRMs (separator stops cross-field matches)
      const texts = [o.vehicle_reg, o.title, o.notes].filter(Boolean).join(' | ')
      for (const reg of o.vehicle_reg ? [normaliseVrm(o.vehicle_reg)] : extractVrms(texts)) {
        if (!vrmToCustomerKey.has(reg)) vrmToCustomerKey.set(reg, key)
      }
      const dup = pending.find((p) => p.sourceKeys.includes(key))
      if (dup) {
        // merge blanks within the batch itself
        for (const k of Object.keys(c)) if (c[k] && !dup.data[k]) dup.data[k] = c[k]
        return
      }
      pending.push({ data: c, sourceKeys: [key] })
    })
  }

  progress({ phase: 'customers', done: 0, total: pending.length, message: 'Importing customers…' })

  const toInsert: Row[] = []
  const insertKeys: string[][] = []
  for (const p of pending) {
    const match = findMatch(p.data)
    if (match) {
      report.customersMerged++
      rememberKeys(p.data, match)
      if (opts.mergeDuplicates) {
        const patch: Row = {}
        for (const k of ['email', 'phone', 'mobile', 'address', 'city', 'postcode', 'notes']) {
          if (p.data[k] && !match[k]) patch[k] = p.data[k]
        }
        if (Object.keys(patch).length) {
          const { error } = await supabase.from('customers').update(patch).eq('id', match.id)
          if (error) report.errors.push(`Merge ${match.first_name} ${match.last_name}: ${error.message}`)
          else Object.assign(match, patch)
        }
      }
    } else {
      toInsert.push({ ...p.data, garage_id })
      insertKeys.push(p.sourceKeys)
    }
  }

  for (let i = 0; i < toInsert.length; i += 100) {
    if (cancelled()) return report
    const chunk = toInsert.slice(i, i + 100)
    const { data, error } = await supabase.from('customers').insert(chunk).select()
    if (error) { report.errors.push(`Customer batch: ${error.message}`); continue }
    ;(data || []).forEach((created: Row, j: number) => {
      report.customersCreated++
      indexCustomer(created)
      rememberKeys(created, created)
      // also remember under the original source keys (email may have been null)
      for (const k of insertKeys[i + j] || []) keyToCustomer.set(k, created)
    })
    progress({ phase: 'customers', done: Math.min(i + 100, toInsert.length), total: toInsert.length, message: 'Importing customers…' })
  }

  // ── Phase 2: bookings ──────────────────────────────────────────────────────
  const apptFiles = allMapped.filter((f) => f.kind === 'appointments')
  const totalAppts = apptFiles.reduce((n, f) => n + f.rows.length, 0)
  progress({ phase: 'bookings', done: 0, total: totalAppts, message: 'Importing appointments…' })

  // Existing bookings → skip exact duplicates (re-running the import is safe).
  const { data: existingBookings } = await supabase.from('bookings').select('start_time,title,customer_id')
  const bookingKey = (start: string, title: string) => `${start}|${(title || '').toLowerCase().trim()}`
  const existingSet = new Set((existingBookings || []).map((b: Row) => bookingKey(b.start_time, b.title)))

  const resolveCustomerId = (o: Row): number | null => {
    const e = normEmail(o.email); if (e && keyToCustomer.has(`e:${e}`)) return keyToCustomer.get(`e:${e}`)!.id
    const p = normPhone(o.phone); if (p && keyToCustomer.has(`p:${p}`)) return keyToCustomer.get(`p:${p}`)!.id
    let first = o.customer_first || o.first_name || '', last = o.customer_last || o.last_name || ''
    if (!first && (o.customer_name || o.full_name)) { const s = splitName(o.customer_name || o.full_name); first = s.first; last = s.last }
    const nk = nameKey(first, last)
    if (nk !== '|' && keyToCustomer.has(`n:${nk}`)) return keyToCustomer.get(`n:${nk}`)!.id
    // fall back to global index (customer existed before this import)
    const m = findMatch({ email: o.email, phone: o.phone, first_name: first, last_name: last })
    return m ? m.id : null
  }

  const mapStatus = (s?: string): string => {
    const t = (s || '').toLowerCase()
    if (/cancel|no.?show|decline/.test(t)) return 'cancelled'
    if (/complete|done|arrived|finish/.test(t)) return 'completed'
    return 'confirmed'
  }

  const bookingsToInsert: Row[] = []
  let done = 0
  for (const f of apptFiles) {
    f.rows.forEach((o, idx) => {
      done++
      // datetime column OR separate date + time
      const ymd = parseDate(o.datetime || o.date || '', opts.dayFirstDates)
      let startMins = parseTime(o.datetime || o.start_time || '')
      if (!ymd) {
        report.skippedRows.push({ file: f.file, row: idx + 2, reason: `Unreadable date "${o.datetime || o.date || ''}"` })
        return
      }
      if (startMins == null) startMins = 9 * 60 // date-only exports → 09:00
      const start = isoLocal(ymd[0], ymd[1], ymd[2], startMins)

      let endMins: number | null = null
      if (o.end_datetime) { const ed = parseDate(o.end_datetime, opts.dayFirstDates); const et = parseTime(o.end_datetime); if (ed && et != null && ed.join() === ymd.join()) endMins = et }
      if (endMins == null && o.end_time) endMins = parseTime(o.end_time)
      if (endMins == null && o.duration_mins && /^\d+$/.test(String(o.duration_mins).trim())) endMins = startMins + parseInt(o.duration_mins, 10)
      if (endMins == null || endMins <= startMins) endMins = startMins + opts.defaultDurationMins
      const end = isoLocal(ymd[0], ymd[1], ymd[2], Math.min(endMins, 23 * 60 + 59))

      const title = o.title || 'Imported appointment'
      if (existingSet.has(bookingKey(start, title))) { report.bookingsSkipped++; return }
      existingSet.add(bookingKey(start, title))

      const noteBits = [
        o.staff ? `Staff: ${o.staff}` : '',
        o.price ? `Price: ${o.price}` : '',
        o.notes || '',
        'Imported',
      ].filter(Boolean)

      bookingsToInsert.push({
        garage_id,
        customer_id: resolveCustomerId(o),
        vehicle_id: null,
        title,
        start_time: start,
        end_time: end,
        status: mapStatus(o.status),
        notes: noteBits.join(' · '),
      })
    })
  }

  for (let i = 0; i < bookingsToInsert.length; i += 100) {
    if (cancelled()) return report
    const chunk = bookingsToInsert.slice(i, i + 100)
    const { data, error } = await supabase.from('bookings').insert(chunk).select('id')
    if (error) report.errors.push(`Booking batch: ${error.message}`)
    else report.bookingsCreated += (data || []).length
    progress({ phase: 'bookings', done: Math.min(i + 100, bookingsToInsert.length), total: bookingsToInsert.length, message: 'Importing appointments…' })
  }

  // ── Phase 3: vehicles from VRMs ────────────────────────────────────────────
  const { data: existingVehicles } = await supabase.from('vehicles').select('registration')
  const haveReg = new Set((existingVehicles || []).map((v: Row) => normaliseVrm(v.registration)))
  const newRegs = [...vrmToCustomerKey.entries()].filter(([reg]) => !haveReg.has(reg))

  progress({ phase: 'vehicles', done: 0, total: newRegs.length, message: 'Building vehicle records…' })

  let i = 0
  for (const [reg, custKey] of newRegs) {
    if (cancelled()) return report
    i++
    const owner = keyToCustomer.get(custKey)
    if (!owner) continue // can't create a vehicle without a customer (FK not null)
    let vehicle: Row = { registration: reg, make: 'Unknown', model: 'Unknown' }
    if (opts.vrmLookup) {
      try {
        const v = await api.lookupVehicle(reg)
        vehicle = {
          registration: v.registration || reg, make: v.make || 'Unknown', model: v.model || 'Unknown',
          year: v.year ?? null, colour: v.colour || null, fuel_type: v.fuel_type || null,
          engine_size: v.engine_size || null, mileage: v.mileage ?? null, mot_due: v.mot_due || null,
        }
        report.vehiclesEnriched++
        await new Promise((r) => setTimeout(r, 700)) // stay well under DVSA rate limits
      } catch {
        report.vrmLookupFailed++ // not a real VRM or lookup down → stub
      }
    }
    const { error } = await supabase.from('vehicles').insert({
      ...vehicle, garage_id, customer_id: owner.id, notes: 'Created by import',
    })
    if (error) report.errors.push(`Vehicle ${reg}: ${error.message}`)
    else report.vehiclesCreated++
    progress({ phase: 'vehicles', done: i, total: newRegs.length, message: `Looking up ${reg}…` })
  }

  progress({ phase: 'done', done: 1, total: 1, message: 'Import complete' })
  return report
}

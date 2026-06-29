// GarageLY data layer — Supabase implementation of the app API.
// Shared verbatim by the desktop (Electron renderer) and the web app.
// Replaces the old Electron IPC bridge; return shapes match what the pages
// already expect (flat joined rows), so no page changes are required.

import { supabase, getGarageId } from './supabase'
import { cached } from './cache'

// Backend Worker (for non-Supabase calls like the vehicle reg lookup).
const BACKEND = import.meta.env.VITE_BACKEND_URL || 'https://garagely-backend.garagely.workers.dev'

// ── helpers ──────────────────────────────────────────────────────────────────
/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>

function unwrap<T>(res: { data: T; error: any }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data
}

// Merge nested relation objects (e.g. { customers: {...} }) up into the parent
// row and drop the nested key, reproducing the old SQL JOIN flat shape.
function flat(row: Row | null, keys: string[]): Row | null {
  if (!row) return row
  const out: Row = { ...row }
  for (const k of keys) {
    const nested = out[k]
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      Object.assign(out, nested)
    }
    delete out[k]
  }
  return out
}

async function settingsRow(): Promise<Row | null> {
  return unwrap(await supabase.from('settings').select('*').limit(1).maybeSingle())
}

// ── API ──────────────────────────────────────────────────────────────────────
const api = {
  // ─── Customers ────────────────────────────────────────────────────────────
  getCustomers: () =>
    cached('customers', async () =>
      unwrap(
        await supabase
          .from('customers_with_counts')
          .select('*')
          .order('last_name')
          .order('first_name'),
      ),
    ),

  getCustomer: (id: number) =>
    cached(`customer:${id}`, async () => {
      const customer = unwrap(
        await supabase.from('customers').select('*').eq('id', id).single(),
      )
      const vehicles = unwrap(
        await supabase.from('vehicles').select('*').eq('customer_id', id).order('registration'),
      )
      const jobs = unwrap(
        await supabase
          .from('jobs_with_totals')
          .select('*')
          .eq('customer_id', id)
          .order('created_at', { ascending: false }),
      )
      return { customer, vehicles, jobs }
    }),

  createCustomer: async (data: any) => {
    const garage_id = await getGarageId()
    return unwrap(
      await supabase.from('customers').insert({ ...data, garage_id }).select().single(),
    )
  },

  updateCustomer: async (id: number, data: any) => {
    const { id: _omit, ...rest } = data ?? {}
    return unwrap(
      await supabase.from('customers').update(rest).eq('id', id).select().single(),
    )
  },

  deleteCustomer: async (id: number) => {
    unwrap(await supabase.from('customers').delete().eq('id', id).select())
    return { success: true }
  },

  // ─── Vehicles ─────────────────────────────────────────────────────────────
  getVehicles: (customerId?: number) =>
    cached(`vehicles:${customerId ?? 'all'}`, async () => {
      let q = supabase
        .from('vehicles')
        .select('*, customers(first_name,last_name)')
        .order('registration')
      if (customerId) q = q.eq('customer_id', customerId)
      const rows = unwrap(await q) as Row[]
      return rows.map((r) => flat(r, ['customers']))
    }),

  getVehicle: (id: number) =>
    cached(`vehicle:${id}`, async () => {
      const raw = unwrap(
        await supabase
          .from('vehicles')
          .select('*, customers(first_name,last_name,email,phone,mobile)')
          .eq('id', id)
          .single(),
      )
      const vehicle = flat(raw, ['customers'])
      const jobs = unwrap(
        await supabase
          .from('jobs')
          .select('*')
          .eq('vehicle_id', id)
          .order('created_at', { ascending: false }),
      )
      const serviceHistory = unwrap(
        await supabase
          .from('jobs')
          .select('completed_date,title,technician_notes,status')
          .eq('vehicle_id', id)
          .not('completed_date', 'is', null)
          .order('completed_date', { ascending: false }),
      )
      return { vehicle, jobs, serviceHistory }
    }),

  createVehicle: async (data: any) => {
    const garage_id = await getGarageId()
    return unwrap(
      await supabase.from('vehicles').insert({ ...data, garage_id }).select().single(),
    )
  },

  updateVehicle: async (id: number, data: any) => {
    const { id: _omit, ...rest } = data ?? {}
    return unwrap(
      await supabase.from('vehicles').update(rest).eq('id', id).select().single(),
    )
  },

  deleteVehicle: async (id: number) => {
    unwrap(await supabase.from('vehicles').delete().eq('id', id).select())
    return { success: true }
  },

  // Free reg lookup via the Worker (DVSA MOT History API).
  lookupVehicle: async (reg: string) => {
    const res = await fetch(`${BACKEND}/vrm-lookup?reg=${encodeURIComponent(reg)}`)
    const j = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error((j as { error?: string }).error || 'Lookup failed')
    return j as {
      registration: string; make: string; model: string; colour: string
      fuel_type: string; engine_size: string; year: number | null; mot_due: string; mileage: number | null
    }
  },

  // AI help assistant (Cloudflare Workers AI via the Worker).
  askAssistant: async (question: string, history: { role: 'user' | 'assistant'; content: string }[] = []) => {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    const res = await fetch(`${BACKEND}/assistant`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ question, history }),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error((j as { error?: string }).error || 'Assistant unavailable')
    return (j as { answer: string }).answer
  },

  // ─── Licence / trial status ───────────────────────────────────────────────
  getLicenceStatus: async () => {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    const res = await fetch(`${BACKEND}/licence-status`, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error((j as { error?: string }).error || 'Could not check licence')
    return j as {
      status: 'trial' | 'active' | 'expired' | 'cancelled' | 'unknown'
      trialEndsAt: string | null; currentPeriodEnd: string | null
      trialDaysLeft: number | null; daysSinceEnd: number; email: string | null
    }
  },

  // Start a Stripe checkout to subscribe; returns the URL to open.
  startCheckout: async (garageName?: string) => {
    const { data } = await supabase.auth.getSession()
    const email = data.session?.user.email
    const res = await fetch(`${BACKEND}/create-checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, garageName: garageName || 'My Garage' }),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok || !(j as { url?: string }).url) throw new Error((j as { error?: string }).error || 'Could not start checkout')
    return (j as { url: string }).url
  },

  // ─── Jobs ─────────────────────────────────────────────────────────────────
  getJobs: (filters?: any) =>
    cached(`jobs:${JSON.stringify(filters ?? {})}`, async () => {
      let q = supabase.from('jobs_with_totals').select('*')
      if (filters?.status) q = q.eq('status', filters.status)
      if (filters?.customerId) q = q.eq('customer_id', filters.customerId)
      if (filters?.search) {
        const s = String(filters.search).replace(/[%,()]/g, '')
        q = q.or(
          `title.ilike.%${s}%,job_number.ilike.%${s}%,last_name.ilike.%${s}%,registration.ilike.%${s}%`,
        )
      }
      return unwrap(await q.order('created_at', { ascending: false }))
    }),

  getJob: (id: number) =>
    cached(`job:${id}`, async () => {
      const raw = unwrap(
        await supabase
          .from('jobs')
          .select(
            '*, customers(first_name,last_name,email,phone,mobile), vehicles(registration,make,model,year,colour,mileage)',
          )
          .eq('id', id)
          .single(),
      )
      const job = flat(raw, ['customers', 'vehicles'])
      const lineItems = unwrap(
        await supabase.from('job_line_items').select('*').eq('job_id', id).order('id'),
      )
      return { job, lineItems }
    }),

  createJob: async (data: any) => {
    const rows = unwrap(await supabase.rpc('create_job', { p: data })) as Row[]
    return rows?.[0]
  },

  updateJob: async (id: number, data: any) => {
    const { id: _omit, ...rest } = data ?? {}
    unwrap(await supabase.from('jobs').update(rest).eq('id', id).select())
    return unwrap(
      await supabase.from('jobs_with_totals').select('*').eq('id', id).single(),
    )
  },

  deleteJob: async (id: number) => {
    unwrap(await supabase.from('jobs').delete().eq('id', id).select())
    return { success: true }
  },

  getJobLineItems: (jobId: number) =>
    cached(`jobLineItems:${jobId}`, async () =>
      unwrap(
        await supabase.from('job_line_items').select('*').eq('job_id', jobId).order('id'),
      ),
    ),

  saveJobLineItems: async (jobId: number, items: any) =>
    unwrap(await supabase.rpc('save_job_line_items', { p_job_id: jobId, items })),

  // ─── Invoices ─────────────────────────────────────────────────────────────
  getInvoices: (filters?: any) =>
    cached(`invoices:${JSON.stringify(filters ?? {})}`, async () => {
      let q = supabase
        .from('invoices')
        .select('*, customers(first_name,last_name), jobs(job_number,title)')
      if (filters?.status) q = q.eq('status', filters.status)
      const rows = unwrap(await q.order('created_at', { ascending: false })) as Row[]
      return rows.map((r) => {
        const o = flat(r, ['customers'])!
        if (r.jobs) {
          o.job_number = r.jobs.job_number
          o.job_title = r.jobs.title
        }
        delete o.jobs
        return o
      })
    }),

  getInvoice: (id: number) =>
    cached(`invoice:${id}`, async () => {
      const raw = unwrap(
        await supabase
          .from('invoices')
          .select(
            '*, customers(first_name,last_name,email,address,city,postcode), jobs(job_number,title,vehicles(registration,make,model))',
          )
          .eq('id', id)
          .single(),
      )
      const invoice = flat(raw, ['customers'])!
      if (raw.jobs) {
        invoice.job_number = raw.jobs.job_number
        invoice.job_title = raw.jobs.title
        const veh = raw.jobs.vehicles
        if (veh) {
          invoice.registration = veh.registration
          invoice.make = veh.make
          invoice.model = veh.model
        }
      }
      delete invoice.jobs
      const lineItems = unwrap(
        await supabase.from('invoice_line_items').select('*').eq('invoice_id', id).order('id'),
      )
      const settings = await settingsRow()
      return { invoice, lineItems, settings }
    }),

  createInvoice: async (data: any) => {
    const { lineItems = [], ...p } = data ?? {}
    const rows = unwrap(
      await supabase.rpc('create_invoice', { p, items: lineItems }),
    ) as Row[]
    return rows?.[0]
  },

  updateInvoice: async (id: number, data: any) => {
    const { id: _omit, lineItems: _li, ...rest } = data ?? {}
    return unwrap(
      await supabase.from('invoices').update(rest).eq('id', id).select().single(),
    )
  },

  deleteInvoice: async (id: number) => {
    unwrap(await supabase.from('invoices').delete().eq('id', id).select())
    return { success: true }
  },

  // ─── Quotes ───────────────────────────────────────────────────────────────
  getQuotes: () =>
    cached('quotes', async () => {
      const rows = unwrap(
        await supabase
          .from('quotes')
          .select('*, customers(first_name,last_name), vehicles(registration,make,model)')
          .order('created_at', { ascending: false }),
      ) as Row[]
      return rows.map((r) => flat(r, ['customers', 'vehicles']))
    }),

  getQuote: (id: number) =>
    cached(`quote:${id}`, async () => {
      const raw = unwrap(
        await supabase
          .from('quotes')
          .select(
            '*, customers(first_name,last_name,email,address,city,postcode), vehicles(registration,make,model)',
          )
          .eq('id', id)
          .single(),
      )
      const quote = flat(raw, ['customers', 'vehicles'])
      const lineItems = unwrap(
        await supabase.from('quote_line_items').select('*').eq('quote_id', id).order('id'),
      )
      const settings = await settingsRow()
      return { quote, lineItems, settings }
    }),

  createQuote: async (data: any) => {
    const { lineItems = [], ...p } = data ?? {}
    const rows = unwrap(await supabase.rpc('create_quote', { p, items: lineItems })) as Row[]
    return rows?.[0]
  },

  updateQuote: async (id: number, data: any) => {
    const { id: _omit, lineItems: _li, ...rest } = data ?? {}
    return unwrap(
      await supabase.from('quotes').update(rest).eq('id', id).select().single(),
    )
  },

  deleteQuote: async (id: number) => {
    unwrap(await supabase.from('quotes').delete().eq('id', id).select())
    return { success: true }
  },

  convertQuoteToJob: async (id: number) => {
    const rows = unwrap(await supabase.rpc('convert_quote_to_job', { p_quote_id: id })) as Row[]
    return rows?.[0]
  },

  convertQuoteToInvoice: async (id: number) => {
    const rows = unwrap(await supabase.rpc('convert_quote_to_invoice', { p_quote_id: id })) as Row[]
    return rows?.[0]
  },

  convertJobToInvoice: async (id: number) => {
    const rows = unwrap(await supabase.rpc('convert_job_to_invoice', { p_job_id: id })) as Row[]
    return rows?.[0]
  },

  // ─── Bookings ─────────────────────────────────────────────────────────────
  getBookings: (filters?: any) =>
    cached(`bookings:${JSON.stringify(filters ?? {})}`, async () => {
      let q = supabase
        .from('bookings')
        .select('*, customers(first_name,last_name), vehicles(registration,make,model)')
      if (filters?.from) q = q.gte('start_time', filters.from)
      if (filters?.to) q = q.lte('start_time', filters.to)
      const rows = unwrap(await q.order('start_time')) as Row[]
      return rows.map((r) => flat(r, ['customers', 'vehicles']))
    }),

  getBooking: (id: number) =>
    cached(`booking:${id}`, async () => {
      const raw = unwrap(
        await supabase
          .from('bookings')
          .select('*, customers(first_name,last_name), vehicles(registration,make,model)')
          .eq('id', id)
          .single(),
      )
      return flat(raw, ['customers', 'vehicles'])
    }),

  createBooking: async (data: any) => {
    const garage_id = await getGarageId()
    return unwrap(
      await supabase.from('bookings').insert({ ...data, garage_id }).select().single(),
    )
  },

  updateBooking: async (id: number, data: any) => {
    const { id: _omit, ...rest } = data ?? {}
    return unwrap(
      await supabase.from('bookings').update(rest).eq('id', id).select().single(),
    )
  },

  deleteBooking: async (id: number) => {
    unwrap(await supabase.from('bookings').delete().eq('id', id).select())
    return { success: true }
  },

  // ─── Parts ────────────────────────────────────────────────────────────────
  getParts: () =>
    cached('parts', async () =>
      unwrap(await supabase.from('parts').select('*').order('name')),
    ),

  getPart: (id: number) =>
    cached(`part:${id}`, async () =>
      unwrap(await supabase.from('parts').select('*').eq('id', id).single()),
    ),

  createPart: async (data: any) => {
    const garage_id = await getGarageId()
    return unwrap(
      await supabase.from('parts').insert({ ...data, garage_id }).select().single(),
    )
  },

  updatePart: async (id: number, data: any) => {
    const { id: _omit, ...rest } = data ?? {}
    return unwrap(await supabase.from('parts').update(rest).eq('id', id).select().single())
  },

  deletePart: async (id: number) => {
    unwrap(await supabase.from('parts').delete().eq('id', id).select())
    return { success: true }
  },

  // Find local motor factors near a postcode (via the Worker → Google Places).
  searchLocalSuppliers: async (postcode: string, radius = 10) => {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    const res = await fetch(`${BACKEND}/places-search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ postcode, radius }),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error((j as { error?: string }).error || 'Search failed')
    return j as { suppliers: Array<{ name: string; address: string; phone: string; website: string; distance: number | null }>; error?: string }
  },

  // ─── Suppliers ────────────────────────────────────────────────────────────
  getSuppliers: () =>
    cached('suppliers', async () =>
      unwrap(await supabase.from('suppliers').select('*').order('name')),
    ),

  createSupplier: async (data: any) => {
    const garage_id = await getGarageId()
    return unwrap(await supabase.from('suppliers').insert({ ...data, garage_id }).select().single())
  },

  updateSupplier: async (id: number, data: any) => {
    const { id: _omit, ...rest } = data ?? {}
    return unwrap(await supabase.from('suppliers').update(rest).eq('id', id).select().single())
  },

  deleteSupplier: async (id: number) => {
    unwrap(await supabase.from('suppliers').delete().eq('id', id).select())
    return { success: true }
  },

  // ─── Preset (pre-quoted) jobs ─────────────────────────────────────────────
  getPresetJobs: () =>
    cached('presetJobs', async () => {
      const jobs = unwrap(
        await supabase.from('preset_jobs').select('*').eq('active', true).order('sort_order').order('name'),
      ) as Row[]
      const items = unwrap(
        await supabase.from('preset_job_items').select('*').order('sort_order').order('id'),
      ) as Row[]
      return jobs.map((j) => ({ ...j, items: items.filter((it) => it.preset_job_id === j.id) }))
    }),

  createPresetJob: async (data: any) => {
    const garage_id = await getGarageId()
    const { items = [], ...rest } = data ?? {}
    const job = unwrap(
      await supabase.from('preset_jobs').insert({ ...rest, garage_id }).select().single(),
    ) as Row
    if (items.length) {
      unwrap(
        await supabase.from('preset_job_items').insert(
          items.map((it: any, i: number) => ({
            garage_id, preset_job_id: job.id, type: it.type || 'part',
            description: it.description || '', quantity: Number(it.quantity) || 1,
            unit_price: Number(it.unit_price) || 0, sort_order: i,
          })),
        ).select(),
      )
    }
    return job
  },

  updatePresetJob: async (id: number, data: any) => {
    const garage_id = await getGarageId()
    const { id: _omit, items = [], created_at: _c, updated_at: _u, garage_id: _g, ...rest } = data ?? {}
    unwrap(await supabase.from('preset_jobs').update(rest).eq('id', id).select())
    // Replace line items wholesale (simplest reliable approach).
    unwrap(await supabase.from('preset_job_items').delete().eq('preset_job_id', id).select())
    if (items.length) {
      unwrap(
        await supabase.from('preset_job_items').insert(
          items.map((it: any, i: number) => ({
            garage_id, preset_job_id: id, type: it.type || 'part',
            description: it.description || '', quantity: Number(it.quantity) || 1,
            unit_price: Number(it.unit_price) || 0, sort_order: i,
          })),
        ).select(),
      )
    }
    return { success: true }
  },

  deletePresetJob: async (id: number) => {
    unwrap(await supabase.from('preset_jobs').delete().eq('id', id).select())
    return { success: true }
  },

  // ─── Digital inspections ──────────────────────────────────────────────────
  getInspections: () =>
    cached('inspections', async () => {
      const rows = unwrap(
        await supabase
          .from('inspections')
          .select('*, vehicles(registration,make,model), customers(first_name,last_name)')
          .order('created_at', { ascending: false }),
      ) as Row[]
      return rows.map((r) => flat(r, ['vehicles', 'customers']))
    }),

  getInspection: (id: number) =>
    cached(`inspection:${id}`, async () => {
      const raw = unwrap(
        await supabase
          .from('inspections')
          .select('*, vehicles(registration,make,model,year,colour,mileage), customers(first_name,last_name,email,phone,mobile)')
          .eq('id', id)
          .single(),
      )
      const inspection = flat(raw, ['vehicles', 'customers'])
      const settings = await settingsRow()
      return { inspection, settings }
    }),

  createInspection: async (data: any) => {
    const garage_id = await getGarageId()
    return unwrap(
      await supabase.from('inspections').insert({ ...data, garage_id }).select().single(),
    )
  },

  updateInspection: async (id: number, data: any) => {
    const { id: _omit, created_at: _c, updated_at: _u, registration: _r, make: _mk, model: _md, first_name: _f, last_name: _l, ...rest } = data ?? {}
    return unwrap(
      await supabase.from('inspections').update(rest).eq('id', id).select().single(),
    )
  },

  deleteInspection: async (id: number) => {
    unwrap(await supabase.from('inspections').delete().eq('id', id).select())
    return { success: true }
  },

  // ─── Feedback / support submissions ───────────────────────────────────────
  getSubmissions: () =>
    cached('submissions', async () =>
      unwrap(await supabase.from('submissions').select('*').order('created_at', { ascending: false })),
    ),

  createSubmission: async (data: any) => {
    const garage_id = await getGarageId()
    return unwrap(await supabase.from('submissions').insert({ ...data, garage_id }).select().single())
  },

  // ─── Dashboard & reports ──────────────────────────────────────────────────
  getDashboardData: () =>
    cached('dashboard', async () => {
      const d = unwrap(await supabase.rpc('dashboard_data')) as Row
      // Belt-and-braces: never raise an MOT/service alert for a vehicle with no
      // (or malformed) date entered. Mirrors the SQL guard in migration 0008 so
      // the fix is live even before that migration is applied.
      const valid = (s: any) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}/.test(s)
      if (d && Array.isArray(d.motAlerts)) d.motAlerts = d.motAlerts.filter((v: Row) => valid(v.mot_due))
      if (d && Array.isArray(d.serviceAlerts)) d.serviceAlerts = d.serviceAlerts.filter((v: Row) => valid(v.service_due))
      return d
    }),

  getRevenueReport: (from: string, to: string) =>
    cached(`report:revenue:${from}:${to}`, async () =>
      unwrap(await supabase.rpc('report_revenue', { p_from: from, p_to: to })),
    ),

  getJobsReport: (from: string, to: string) =>
    cached(`report:jobs:${from}:${to}`, async () =>
      unwrap(await supabase.rpc('report_jobs', { p_from: from, p_to: to })),
    ),

  // ─── Technicians ──────────────────────────────────────────────────────────
  getTechnicians: (includeInactive = false) =>
    cached(`technicians:${includeInactive}`, async () => {
      let q = supabase.from('technicians').select('*').order('name')
      if (!includeInactive) q = q.eq('active', true)
      return unwrap(await q)
    }),

  createTechnician: async (data: any) => {
    const garage_id = await getGarageId()
    return unwrap(await supabase.from('technicians').insert({ ...data, garage_id }).select().single())
  },

  updateTechnician: async (id: number, data: any) => {
    const { id: _omit, ...rest } = data ?? {}
    return unwrap(await supabase.from('technicians').update(rest).eq('id', id).select().single())
  },

  deleteTechnician: async (id: number) => {
    unwrap(await supabase.from('technicians').delete().eq('id', id).select())
    return { success: true }
  },

  // ─── Technician time-off (rota exceptions) ────────────────────────────────
  getTimeOff: (from?: string, to?: string) =>
    cached(`timeoff:${from ?? ''}:${to ?? ''}`, async () => {
      let q = supabase.from('technician_time_off').select('*')
      if (from) q = q.gte('day', from)
      if (to) q = q.lte('day', to)
      return unwrap(await q.order('day'))
    }),

  // Upsert a single day's exception for a technician ('off' | 'half').
  setTimeOff: async (technician_id: number, day: string, kind: 'off' | 'half', note?: string) => {
    const garage_id = await getGarageId()
    return unwrap(
      await supabase
        .from('technician_time_off')
        .upsert({ technician_id, day, kind, note: note ?? null, garage_id }, { onConflict: 'technician_id,day' })
        .select()
        .single(),
    )
  },

  // Remove an exception (technician is back to working that day).
  clearTimeOff: async (technician_id: number, day: string) => {
    unwrap(
      await supabase.from('technician_time_off').delete().eq('technician_id', technician_id).eq('day', day).select(),
    )
    return { success: true }
  },

  // ─── Settings ─────────────────────────────────────────────────────────────
  getSettings: () => cached('settings', async () => settingsRow()),

  updateSettings: async (data: any) => {
    const { id: _omit, ...rest } = data ?? {}
    unwrap(await supabase.from('settings').update(rest).gte('id', 0).select())
    return settingsRow()
  },

  // ─── Demo mode ────────────────────────────────────────────────────────────
  endDemoMode: async () => {
    unwrap(await supabase.rpc('end_demo_mode'))
    return { success: true }
  },

  isDemo: async (): Promise<boolean> => {
    const row = unwrap(
      await supabase.from('garages').select('is_demo').limit(1).maybeSingle(),
    ) as Row | null
    return !!row?.is_demo
  },
}

// Kept for type-compatibility with existing imports.
export interface GaragelyAPI {
  [key: string]: (...args: any[]) => Promise<any>
}

export default api

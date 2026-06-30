/**
 * GarageLY Backend — Cloudflare Worker
 * ------------------------------------
 * A single Worker that replaces the six Netlify Functions. It routes on the
 * LAST path segment, so both of these resolve to the same handler:
 *
 *   https://garagely-backend.<sub>.workers.dev/admin-api
 *   https://garagely-backend.<sub>.workers.dev/.netlify/functions/admin-api
 *
 * Keeping the /.netlify/functions/* path means existing frontends (and any
 * already-installed desktop app) keep working without a rebuild.
 *
 * Endpoints: activate-account, validate-licence, create-checkout,
 *            get-key-by-session, stripe-webhook, admin-api
 *
 * Config (set via `wrangler secret put` unless noted as a [vars] entry):
 *   SUPABASE_URL                (var)    e.g. https://xxxx.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY   (secret) service-role key — server only
 *   STRIPE_SECRET_KEY           (secret)
 *   STRIPE_WEBHOOK_SECRET       (secret) whsec_… from the Stripe webhook
 *   STRIPE_PRICE_ID             (var)    price_… for the subscription
 *   ADMIN_SECRET                (secret) admin dashboard password
 *   TRIAL_DAYS                  (var)    default 14
 *   SITE_URL                    (var)    marketing site (for Stripe redirects)
 *   RESEND_API_KEY              (secret) optional — licence emails (Resend.com)
 *   RESEND_FROM                 (var)    optional — verified sender address (e.g. info@getgaragely.com)
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

export interface Env {
  SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY: string
  STRIPE_SECRET_KEY: string
  STRIPE_WEBHOOK_SECRET: string
  STRIPE_PRICE_ID: string
  ADMIN_SECRET: string
  TRIAL_DAYS?: string
  SITE_URL?: string
  RESEND_API_KEY?: string
  RESEND_FROM?: string
  // DVSA MOT History API (free reg lookup) — optional until configured.
  DVSA_CLIENT_ID?: string
  DVSA_CLIENT_SECRET?: string
  DVSA_API_KEY?: string
  DVSA_TOKEN_URL?: string
  DVSA_SCOPE_URL?: string
  // Google Places (New) + Geocoding — local supplier search. Optional until set.
  GOOGLE_PLACES_API_KEY?: string
  // Cloudflare Workers AI binding (free in-app help assistant).
  AI: Ai
}

// ── Shared helpers ──────────────────────────────────────────────────────────
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Secret, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

function text(status: number, body: string): Response {
  return new Response(body, { status, headers: CORS })
}

function sb(env: Env): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

function stripeClient(env: Env): Stripe {
  return new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: '2024-06-20',
    httpClient: Stripe.createFetchHttpClient(),
  })
}

function generateLicenceKey(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const seg = () =>
    Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  return `GRLY-${seg()}-${seg()}-${seg()}`
}

const KEY_RE = /^GRLY-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/

// ── Router ──────────────────────────────────────────────────────────────────
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })

    const url = new URL(request.url)
    // Route on the last path segment so /foo and /.netlify/functions/foo both work.
    const name = url.pathname.replace(/\/+$/, '').split('/').pop() || ''

    try {
      switch (name) {
        case 'activate-account':   return await activateAccount(request, env)
        case 'validate-licence':   return await validateLicence(request, env)
        case 'licence-status':     return await licenceStatus(request, env)
        case 'create-checkout':    return await createCheckout(request, env)
        case 'get-key-by-session': return await getKeyBySession(request, env, url)
        case 'stripe-webhook':     return await stripeWebhook(request, env)
        case 'vrm-lookup':         return await vrmLookup(request, env, url)
        case 'assistant':          return await assistant(request, env)
        case 'places-search':      return await placesSearch(request, env)
        case 'admin-api':          return await adminApi(request, env, url)
        case '':
        case 'health':             return json(200, { ok: true, service: 'garagely-backend' })
        default:                   return json(404, { error: `Unknown endpoint: ${name}` })
      }
    } catch (err: any) {
      console.error(`Handler ${name} threw:`, err?.message || err)
      return json(500, { error: 'Internal error' })
    }
  },
}

// ── activate-account ────────────────────────────────────────────────────────
async function activateAccount(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed' })

  let key = '', email = '', password = '', garageName: string | undefined
  try {
    const b = (await request.json()) as any
    key = String(b.key || '').trim().toUpperCase()
    email = String(b.email || '').trim().toLowerCase()
    password = String(b.password || '')
    garageName = b.garageName ? String(b.garageName).trim() : undefined
  } catch {
    return json(400, { error: 'Invalid request body' })
  }

  if (!KEY_RE.test(key)) return json(400, { error: 'Invalid licence key format.' })
  if (!email.includes('@')) return json(400, { error: 'Please enter a valid email address.' })
  if (password.length < 6) return json(400, { error: 'Password must be at least 6 characters.' })

  const supabase = sb(env)

  const { data: licence, error: licErr } = await supabase
    .from('licences').select('*').eq('key', key).single()
  if (licErr || !licence) return json(200, { error: 'Licence key not found.' })

  if (licence.status === 'expired' || licence.status === 'cancelled') {
    return json(200, { error: 'This licence is no longer active.' })
  }
  if (licence.status === 'trial' && licence.trial_ends_at && new Date(licence.trial_ends_at) < new Date()) {
    await supabase.from('licences').update({ status: 'expired' }).eq('id', licence.id)
    return json(200, { error: 'Trial period has ended. Please subscribe to continue.' })
  }

  const { data: existingGarage } = await supabase
    .from('garages').select('id').eq('licence_key', key).maybeSingle()
  if (existingGarage) {
    return json(200, { error: 'This licence is already linked to an account. Please sign in instead.' })
  }

  const { data: created, error: userErr } = await supabase.auth.admin.createUser({
    email, password, email_confirm: true,
  })
  if (userErr || !created?.user) {
    const msg = /already.*registered|exists/i.test(userErr?.message || '')
      ? 'An account with this email already exists. Please sign in instead.'
      : userErr?.message || 'Could not create the account.'
    return json(200, { error: msg })
  }
  const userId = created.user.id
  const rollback = async () => { await supabase.auth.admin.deleteUser(userId).catch(() => {}) }

  const { data: garage, error: gErr } = await supabase
    .from('garages')
    .insert({ name: garageName || licence.garage_name || 'My Garage', licence_key: key, is_demo: true })
    .select('id').single()
  if (gErr || !garage) {
    await rollback()
    return json(500, { error: 'Could not create garage record.' })
  }

  const { error: mErr } = await supabase
    .from('garage_members').insert({ user_id: userId, garage_id: garage.id, role: 'owner' })
  if (mErr) {
    await supabase.from('garages').delete().eq('id', garage.id)
    await rollback()
    return json(500, { error: 'Could not link account to garage.' })
  }

  const { error: seedErr } = await supabase.rpc('seed_demo_data', { g: garage.id })
  if (seedErr) console.error('seed_demo_data failed:', seedErr.message)

  await supabase.from('activation_log').insert({
    licence_id: licence.id,
    event: 'account_activated',
    metadata: { email, garage_id: garage.id, ip: request.headers.get('cf-connecting-ip') || 'unknown' },
  })

  return json(200, { success: true, garageId: garage.id })
}

// ── validate-licence ────────────────────────────────────────────────────────
async function validateLicence(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed' })

  let key = ''
  try {
    const body = (await request.json()) as any
    key = (body.key || '').trim().toUpperCase()
  } catch {
    return json(400, { valid: false, error: 'Invalid request body' })
  }
  if (!key) return json(400, { valid: false, error: 'No licence key provided' })

  const supabase = sb(env)
  const { data, error } = await supabase.from('licences').select('*').eq('key', key).single()
  if (error || !data) return json(200, { valid: false, error: 'Licence key not found' })

  if (data.status === 'trial' && data.trial_ends_at && new Date(data.trial_ends_at) < new Date()) {
    await supabase.from('licences').update({ status: 'expired' }).eq('id', data.id)
    return json(200, { valid: false, status: 'expired', error: 'Trial period has ended. Please subscribe to continue.' })
  }
  if (data.status === 'expired' || data.status === 'cancelled') {
    return json(200, { valid: false, status: data.status, error: 'Subscription is no longer active.' })
  }

  await supabase.from('activation_log').insert({
    licence_id: data.id,
    event: 'validation_ok',
    metadata: { ip: request.headers.get('cf-connecting-ip') || 'unknown' },
  })

  return json(200, {
    valid: true,
    status: data.status,
    garageName: data.garage_name,
    trialEndsAt: data.trial_ends_at,
    currentPeriodEnd: data.current_period_end,
  })
}

// ── licence-status ────────────────────────────────────────────────────────--
// Signed-in app users: returns their licence status + trial days remaining so
// the app can show a countdown, an end-of-trial prompt, or a lock screen.
// Read-only (no activation_log writes, no auto-expire side effects).
async function licenceStatus(request: Request, env: Env): Promise<Response> {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) return json(401, { error: 'Not signed in' })
  const supabase = sb(env)
  const { data: u, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !u?.user) return json(401, { error: 'Session expired' })

  // user → garage → licence_key → licence
  const mem = await supabase.from('garage_members').select('garage_id').eq('user_id', u.user.id).limit(1).maybeSingle()
  const garageId = mem.data?.garage_id
  if (!garageId) return json(200, { status: 'unknown' })
  const g = await supabase.from('garages').select('licence_key').eq('id', garageId).maybeSingle()
  const key = g.data?.licence_key
  if (!key) return json(200, { status: 'unknown' })
  const lic = await supabase.from('licences').select('status,trial_ends_at,current_period_end').eq('key', key).maybeSingle()
  if (!lic.data) return json(200, { status: 'unknown' })

  const now = Date.now()
  const end = lic.data.trial_ends_at ? new Date(lic.data.trial_ends_at).getTime() : null
  const dayMs = 86400_000
  // Whole days left until trial end (negative once past).
  const trialDaysLeft = end != null ? Math.ceil((end - now) / dayMs) : null
  // Days since trial ended (for the post-expiry grace window).
  const daysSinceEnd = end != null && end < now ? Math.floor((now - end) / dayMs) : 0

  return json(200, {
    status: lic.data.status,                         // trial | active | expired | cancelled
    trialEndsAt: lic.data.trial_ends_at || null,
    currentPeriodEnd: lic.data.current_period_end || null,
    trialDaysLeft,
    daysSinceEnd,
    email: u.user.email || null,
  })
}

// ── create-checkout ─────────────────────────────────────────────────────────
async function createCheckout(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return text(405, 'Method not allowed')

  let email = '', garageName = 'My Garage'
  try {
    const body = (await request.json()) as any
    email = body.email?.trim()
    garageName = body.garageName?.trim() || 'My Garage'
  } catch {
    return json(400, { error: 'Invalid request' })
  }
  if (!email) return json(400, { error: 'email required' })

  const stripe = stripeClient(env)
  const site = env.SITE_URL || 'https://getgaragely.com'
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    customer_email: email,
    line_items: [{ price: env.STRIPE_PRICE_ID, quantity: 1 }],
    subscription_data: {
      trial_period_days: Number(env.TRIAL_DAYS) || 14,
      metadata: { garage_name: garageName, email },
    },
    metadata: { garage_name: garageName, email },
    success_url: `${site}/success.html?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${site}/#pricing`,
  })

  return json(200, { url: session.url })
}

// ── get-key-by-session ──────────────────────────────────────────────────────
async function getKeyBySession(request: Request, env: Env, url: URL): Promise<Response> {
  if (request.method !== 'GET') return text(405, 'Method not allowed')

  const sessionId = url.searchParams.get('session_id')
  if (!sessionId) return json(400, { error: 'session_id required' })

  const stripe = stripeClient(env)
  let email: string
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    const e = session.customer_email || session.customer_details?.email
    if (!e) return json(404, { error: 'Session email not found' })
    email = e
  } catch {
    return json(404, { error: 'Invalid session' })
  }

  const supabase = sb(env)
  const { data, error } = await supabase
    .from('licences')
    .select('key, email, status, trial_ends_at')
    .eq('email', email.toLowerCase())
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) return json(202, { error: 'Key not ready yet', retry: true })
  return json(200, { key: data.key, email: data.email, status: data.status })
}

// ── stripe-webhook ──────────────────────────────────────────────────────────
async function stripeWebhook(request: Request, env: Env): Promise<Response> {
  const sig = request.headers.get('stripe-signature')
  if (!sig) return text(400, 'No signature')

  const rawBody = await request.text()
  const stripe = stripeClient(env)

  let stripeEvent: Stripe.Event
  try {
    // Workers have no synchronous crypto — use the async verifier + SubtleCrypto.
    stripeEvent = await stripe.webhooks.constructEventAsync(
      rawBody,
      sig,
      env.STRIPE_WEBHOOK_SECRET,
      undefined,
      Stripe.createSubtleCryptoProvider(),
    )
  } catch (err: any) {
    console.error('Webhook signature failed:', err.message)
    return text(400, `Webhook Error: ${err.message}`)
  }

  const supabase = sb(env)
  const data = stripeEvent.data.object as any

  switch (stripeEvent.type) {
    case 'checkout.session.completed': {
      const session = data as Stripe.Checkout.Session
      const email = session.customer_details?.email || session.metadata?.email || ''
      const garageName = session.metadata?.garage_name || 'My Garage'
      const subscriptionId = session.subscription as string
      const customerId = session.customer as string

      const sub = await stripe.subscriptions.retrieve(subscriptionId)
      const periodEnd = new Date(sub.current_period_end * 1000).toISOString()

      // If this email already has a licence (e.g. a trial tester converting from
      // the in-app prompt), UPGRADE that licence to active — keeps their existing
      // key, which is the one linked to their account/garage, so the app unlocks.
      const prior = email
        ? await supabase.from('licences').select('id,key').eq('email', email).order('created_at', { ascending: false }).limit(1).maybeSingle()
        : { data: null }

      if (prior.data?.id) {
        const { error } = await supabase.from('licences').update({
          status: 'active', stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId, current_period_end: periodEnd,
        }).eq('id', prior.data.id)
        if (error) { console.error('Failed to upgrade licence:', error); return text(500, 'Database error') }
        console.log(`Licence upgraded to active: ${prior.data.key} for ${email}`)
        break
      }

      let key = generateLicenceKey()
      let attempts = 0
      while (attempts < 5) {
        const existing = await supabase.from('licences').select('id').eq('key', key).single()
        if (existing.error) break
        key = generateLicenceKey()
        attempts++
      }

      const { error } = await supabase.from('licences').insert({
        key, email, garage_name: garageName, status: 'active',
        stripe_customer_id: customerId, stripe_subscription_id: subscriptionId,
        current_period_end: periodEnd,
      })
      if (error) {
        console.error('Failed to create licence:', error)
        return text(500, 'Database error')
      }
      console.log(`New licence created: ${key} for ${email}`)
      await sendLicenceEmail(env, email, key, garageName)
      break
    }

    case 'invoice.payment_succeeded': {
      const invoice = data as Stripe.Invoice
      const subscriptionId = invoice.subscription as string
      const sub = await stripe.subscriptions.retrieve(subscriptionId)
      const periodEnd = new Date(sub.current_period_end * 1000).toISOString()
      await supabase.from('licences')
        .update({ status: 'active', current_period_end: periodEnd })
        .eq('stripe_subscription_id', subscriptionId)
      break
    }

    case 'invoice.payment_failed': {
      const invoice = data as Stripe.Invoice
      console.warn(`Payment failed for subscription: ${invoice.subscription}`)
      break
    }

    case 'customer.subscription.deleted': {
      const sub = data as Stripe.Subscription
      await supabase.from('licences').update({ status: 'cancelled' }).eq('stripe_subscription_id', sub.id)
      break
    }

    case 'customer.subscription.updated': {
      const sub = data as Stripe.Subscription
      const periodEnd = new Date(sub.current_period_end * 1000).toISOString()
      const status = sub.status === 'active' ? 'active'
        : sub.status === 'trialing' ? 'trial'
        : sub.status === 'canceled' ? 'cancelled'
        : 'expired'
      await supabase.from('licences')
        .update({ status, current_period_end: periodEnd })
        .eq('stripe_subscription_id', sub.id)
      break
    }
  }

  return json(200, { received: true })
}

async function sendLicenceEmail(env: Env, to: string, key: string, garageName: string): Promise<void> {
  const apiKey = env.RESEND_API_KEY
  const from = env.RESEND_FROM || 'GarageLY <info@getgaragely.com>'
  if (!apiKey || !to) {
    console.log('Licence email skipped — RESEND_API_KEY not configured')
    return
  }
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#111">
      <h2 style="color:#F4A523">Welcome to GarageLY 🔧</h2>
      <p>Your 14-day free trial for <strong>${garageName}</strong> is active. Here's your licence key:</p>
      <div style="background:#0f1117;color:#F4A523;font-family:monospace;font-size:22px;font-weight:bold;
                  letter-spacing:2px;text-align:center;padding:18px;border-radius:10px;margin:18px 0">
        ${key}
      </div>
      <p style="background:#fff7e6;border:1px solid #F4A523;border-radius:8px;padding:12px;color:#7a5200">
        ⚠️ <strong>Save this email.</strong> You'll need this key to activate the app and to sign in on any other device.
      </p>
    </div>`
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [to],
        subject: 'Your GarageLY licence key — please save this email',
        html,
      }),
    })
    if (!res.ok) console.error('Resend error:', res.status, await res.text())
  } catch (err) {
    console.error('Licence email failed:', (err as Error).message)
  }
}

async function sendResetEmail(env: Env, to: string, link: string): Promise<void> {
  const apiKey = env.RESEND_API_KEY
  const from = env.RESEND_FROM || 'GarageLY <info@getgaragely.com>'
  if (!apiKey || !to) return
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#111">
      <h2 style="color:#F4A523">Reset your GarageLY password</h2>
      <p>We received a request to reset the password for your GarageLY account. Click below to choose a new one:</p>
      <p style="text-align:center;margin:22px 0">
        <a href="${link}" style="background:#F4A523;color:#111;text-decoration:none;font-weight:bold;
           padding:12px 22px;border-radius:8px;display:inline-block">Reset password</a>
      </p>
      <p style="color:#666;font-size:13px">If you didn't request this, you can safely ignore this email.</p>
    </div>`
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [to],
        subject: 'Reset your GarageLY password',
        html,
      }),
    })
    if (!res.ok) console.error('Resend reset error:', res.status, await res.text())
  } catch (err) {
    console.error('Reset email failed:', (err as Error).message)
  }
}

// ── places-search (local supplier finder, Google Places New + Geocoding) ──────
// Signed-in users only (protects the API key/quota). Geocodes a postcode, then
// text-searches for motor factors / car-parts shops biased to that area, and
// returns name / address / phone / website with distance, nearest first.
async function placesSearch(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed' })
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) return json(401, { error: 'Please sign in to search.' })
  const { data: u, error: authErr } = await sb(env).auth.getUser(token)
  if (authErr || !u?.user) return json(401, { error: 'Your session expired — sign in again.' })

  const key = env.GOOGLE_PLACES_API_KEY
  if (!key) return json(400, { error: "Local supplier search isn't set up yet. Add a GOOGLE_PLACES_API_KEY secret to the Worker (see ROUND4_NEXT_STEPS.md)." })

  let body: any = {}
  try { body = await request.json() } catch { /* ignore */ }
  const postcode = String(body.postcode || '').trim()
  const radiusMiles = Math.min(Math.max(Number(body.radius) || 10, 1), 30)
  if (!postcode) return json(400, { error: 'Enter a postcode.' })

  // 1) Geocode the postcode → lat/lng.
  const geoRes = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(postcode + ', UK')}&region=gb&key=${key}`,
  )
  const geo: any = await geoRes.json().catch(() => ({}))
  if (geo.status === 'REQUEST_DENIED') return json(502, { error: `Google rejected the request: ${geo.error_message || 'check the API key & enabled APIs'}` })
  const loc = geo?.results?.[0]?.geometry?.location
  if (!loc) return json(200, { suppliers: [], error: 'Postcode not found — check it and try again.' })

  // 2) Text Search (New) biased to that circle.
  const radiusM = Math.round(radiusMiles * 1609.34)
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,places.location',
    },
    body: JSON.stringify({
      textQuery: 'motor factors car parts',
      regionCode: 'GB',
      maxResultCount: 20,
      locationBias: { circle: { center: { latitude: loc.lat, longitude: loc.lng }, radius: radiusM } },
    }),
  })
  const pj: any = await res.json().catch(() => ({}))
  if (pj.error) return json(502, { error: pj.error.message || 'Places search failed.' })

  const toRad = (d: number) => (d * Math.PI) / 180
  const miles = (aLat: number, aLng: number, bLat: number, bLng: number) => {
    const R = 3958.8
    const dLat = toRad(bLat - aLat), dLng = toRad(bLng - aLng)
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2
    return 2 * R * Math.asin(Math.sqrt(s))
  }

  const suppliers = (pj.places || [])
    .map((p: any) => {
      const d = p.location ? +miles(loc.lat, loc.lng, p.location.latitude, p.location.longitude).toFixed(1) : null
      return {
        name: p.displayName?.text || '',
        address: p.formattedAddress || '',
        phone: p.nationalPhoneNumber || p.internationalPhoneNumber || '',
        website: p.websiteUri || '',
        distance: d,
      }
    })
    .filter((s: any) => s.name && (s.distance == null || s.distance <= radiusMiles + 0.5))
    .sort((a: any, b: any) => (a.distance ?? 999) - (b.distance ?? 999))

  return json(200, { suppliers })
}

// ── vrm-lookup (DVSA MOT History API) ────────────────────────────────────────
// Free UK vehicle lookup: returns make, model, colour, fuel, engine size, year
// and recent MOT history from a registration. OAuth2 client-credentials flow.
let dvsaToken: { value: string; exp: number } | null = null

async function getDvsaToken(env: Env): Promise<string> {
  if (dvsaToken && dvsaToken.exp > Date.now() + 60_000) return dvsaToken.value
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: env.DVSA_CLIENT_ID || '',
    client_secret: env.DVSA_CLIENT_SECRET || '',
    scope: env.DVSA_SCOPE_URL || '',
  })
  const res = await fetch(env.DVSA_TOKEN_URL || '', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) throw new Error('DVSA token request failed')
  const j: any = await res.json()
  dvsaToken = { value: j.access_token, exp: Date.now() + (Number(j.expires_in) || 3600) * 1000 }
  return dvsaToken.value
}

async function vrmLookup(request: Request, env: Env, url: URL): Promise<Response> {
  const reg = (url.searchParams.get('reg') || '').replace(/\s+/g, '').toUpperCase()
  if (!reg) return json(400, { error: 'reg required' })
  if (!env.DVSA_API_KEY || !env.DVSA_CLIENT_ID) {
    return json(503, { error: 'Vehicle lookup is not set up yet.' })
  }
  try {
    const token = await getDvsaToken(env)
    const res = await fetch(
      `https://history.mot.api.gov.uk/v1/trade/vehicles/registration/${encodeURIComponent(reg)}`,
      { headers: { Authorization: `Bearer ${token}`, 'x-api-key': env.DVSA_API_KEY, Accept: 'application/json' } },
    )
    if (res.status === 404) return json(404, { error: 'No vehicle found for that registration.' })
    if (!res.ok) return json(502, { error: 'Lookup service error. Try again shortly.' })
    const v: any = await res.json()
    const tests = Array.isArray(v.motTests) ? v.motTests : []
    const latest = tests[0] || null
    const year = String(v.manufactureDate || v.firstUsedDate || v.registrationDate || '').slice(0, 4)
    return json(200, {
      registration: v.registration || reg,
      make: v.make || '',
      model: v.model || '',
      colour: v.primaryColour || '',
      fuel_type: v.fuelType || '',
      engine_size: v.engineSize ? String(v.engineSize) : '',
      year: year ? Number(year) : null,
      mot_due: latest?.expiryDate || '',
      mileage: latest?.odometerValue ? Number(String(latest.odometerValue).replace(/\D/g, '')) || null : null,
      mot_history: tests.slice(0, 5).map((m: any) => ({
        date: m.completedDate, result: m.testResult, mileage: m.odometerValue, expiry: m.expiryDate,
      })),
    })
  } catch {
    return json(502, { error: 'Lookup failed. Try again shortly.' })
  }
}

// ── assistant (Cloudflare Workers AI help bot) ───────────────────────────────
const GARAGELY_GUIDE = `You are Timmy — a cheerful, slightly cheeky 10mm socket who is the in-app help
mascot for GarageLY (garage/workshop management software, desktop + web). GarageLY users are
mechanics and garage owners, so talk like a mate in the workshop. Use UK English.

PERSONALITY:
- You're a 10mm socket: proud of it, and you make the occasional self-deprecating joke about
  how 10mm sockets are always the first tool to go missing in a workshop.
- Keep it warm, light and a bit funny. A short car/mechanic pun or quip at the start or end is
  welcome WHEN it fits — but never let a joke get in the way of actually answering the question.
- If the user explicitly asks for a joke, give them a quick car/mechanic one and a smiley.
- Don't force humour onto serious or error questions; read the room.

YOUR JOB: answer questions about how to use GarageLY. Be brief and practical. Give step-by-step
directions naming the exact menu/button. If you don't know, say so and point them to
"Help & Feedback". Never invent features that aren't listed here.

THE LEFT SIDEBAR (top to bottom): Dashboard, Calendar, Team, Customers, Vehicles, Quotes,
Preset Jobs, Job Sheets, Invoices, Parts, Suppliers, Reports, Settings, Help & Feedback.

WHAT EACH DOES & HOW TO DO THINGS:
- Dashboard: overview — revenue this month, outstanding invoices, today's bookings, MOT/service due, recent activity.
- Calendar: bookings in Day/Week/Month. "New Booking" (top right) to add one — pick title, date/time, customer, vehicle, technician. Coloured dots per day show which technicians are working; a booking takes its technician's colour. Click a booking to see details and "Open Job Sheet".
- Team: add technicians ("New Technician"), each with a colour. In the technician form set their Working days and Hours (shift pattern). "Book time off" books a full or half day off (e.g. doctor's). The calendar reflects all of this.
- Customers: add/edit customers; click one for their detail, vehicles and history. Call button next to phone numbers.
- Vehicles: add/edit vehicles. The "Look up" button next to Registration auto-fills make/model/colour/fuel/engine size/MOT from the reg (if reg lookup is set up).
- Quotes: create estimates with line items. "+ Labour" adds a labour line at your labour rate. "+ Preset job" lets you tick one or more saved jobs (e.g. "Fit MQB intercooler") and drops all their parts + labour lines straight into the quote. Convert a quote to a Job Sheet or straight to an Invoice using the arrows in the Actions column. Converting to a job pops a "Book this job in?" calendar slot picker.
- Preset Jobs: build a catalogue of jobs you quote often. Each preset holds its own parts + labour line items, so when someone rings up wanting, say, an intercooler + downpipe + tuning, you tick those presets in the Quotes screen and the lines fill themselves in. Add/edit them with "New Preset Job".
- Job Sheets: the work in progress. Open one to edit line items, add Technician Notes, assign a Technician, "Add to calendar", "Print" a clean job sheet, or "Create Invoice" (technician notes carry over to the invoice notes).
- Invoices: bills. Statuses draft/unpaid/paid/overdue. Print/PDF.
- Parts: parts inventory with cost/sale price and stock levels (low-stock warnings).
- Suppliers: supplier contacts (phone with call button, website, account number).
- Reports: revenue and jobs reports over a date range.
- Settings: Business Details (name, address, phone, email, VAT number); Branding & Appearance (upload your logo, pick an accent colour, choose comfortable/compact density); Rates & Pricing (default Labour Rate and VAT Rate); Documents & Templates (default quote/invoice notes, terms & conditions, bank details, invoice & job-sheet footers); Reminders (MOT/service alert lead time in days); Opening Hours (per-day open/closed + times — drives the calendar working days); Invoice & Quote Numbering (prefixes and next numbers). Remember to click "Save Changes".
- Help & Feedback: ask this assistant, or send Feedback/ideas or a Support request to the GarageLY team.

COMMON ANSWERS:
- Change VAT or labour rate → Settings → Rates & Pricing.
- Add your logo → Settings → Logo & Branding → Upload logo → Save Changes.
- Set opening hours → Settings → Opening Hours.
- Add a mechanic and their shifts → Team → New Technician (set working days + hours).
- Book someone off → Team → Book time off.
- Book a job into the calendar → open the Job Sheet → "Add to calendar" (or convert a quote to a job and use the slot picker).
- Quote → job → invoice flow: Quotes (convert) → Job Sheets (do the work, add notes) → Create Invoice.

IMPORTANT RULES:
- Do NOT invent field names, buttons or steps that aren't described above. If you're not certain of the exact steps, give your best general direction and tell them which screen to open — don't make up specifics.
- When your answer is about a specific screen, finish your reply with a line exactly like:
GOTO: /invoices
using ONE of these paths only: /dashboard /calendar /team /customers /vehicles /quotes /preset-jobs /jobs /invoices /parts /suppliers /reports /settings /help. Include at most one GOTO line, only when there's a clear screen to open, and do not refer to the GOTO line in your prose.`

async function assistant(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed' })
  // Only logged-in users — protects the free AI allowance from abuse.
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) return json(401, { error: 'Please sign in to use the assistant.' })
  const { data: u, error: authErr } = await sb(env).auth.getUser(token)
  if (authErr || !u?.user) return json(401, { error: 'Your session expired — sign in again.' })

  let body: any = {}
  try { body = await request.json() } catch { return json(400, { error: 'Invalid request' }) }
  const question = String(body.question || '').slice(0, 1000).trim()
  if (!question) return json(400, { error: 'Ask a question.' })
  const history = Array.isArray(body.history) ? body.history.slice(-6) : []

  const messages = [
    { role: 'system', content: GARAGELY_GUIDE },
    ...history.map((h: any) => ({
      role: h.role === 'user' ? 'user' : 'assistant',
      content: String(h.content || '').slice(0, 1500),
    })),
    { role: 'user', content: question },
  ]
  try {
    const r: any = await env.AI.run('@cf/meta/llama-3.2-3b-instruct', { messages, max_tokens: 400 })
    const answer = (r?.response || '').trim()
    return json(200, { answer: answer || "Sorry, I couldn't find an answer. Try rephrasing, or send a support request from Help & Feedback." })
  } catch (e) {
    console.error('AI error:', (e as Error)?.message)
    return json(502, { error: 'The assistant is busy right now — please try again in a moment.' })
  }
}

// Branded trial-invite email (HTML) — mirrors the approved design.
function inviteEmailHtml(key: string, trialDays: number): string {
  const site = 'https://getgaragely.com'
  const app = 'https://app.getgaragely.com'
  return `<div style="background:#f4f5f7;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" align="center" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e6e8ec;">
    <tr><td style="background:#0f1117;padding:28px 24px;text-align:center;border-bottom:3px solid #F4A523;">
      <img src="${site}/garagely-email-logo.png" alt="GarageLY" width="280" style="display:inline-block;width:280px;max-width:72%;height:auto;" />
      <div style="margin-top:12px;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#9aa0ac;">Garage Management, Made Simple</div>
    </td></tr>
    <tr><td style="padding:32px 32px 8px 32px;">
      <h1 style="margin:0 0 6px;font-size:22px;line-height:1.3;color:#16181d;">You're invited to try GarageLY free for ${trialDays} days</h1>
      <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#5b6270;">No card needed. GarageLY is a <strong style="color:#16181d;">budget-friendly garage management system</strong> — bookings, job sheets, quotes, invoices, customers and vehicles, all in one place on desktop and in your browser.</p>
      <p style="margin:0 0 8px;font-size:13px;color:#8a909c;text-transform:uppercase;letter-spacing:.04em;">Your licence key</p>
      <div style="background:#0f1117;border-radius:10px;padding:14px;text-align:center;margin:0 0 22px;border:1px solid #2a2d35;">
        <span style="font-family:'Courier New',monospace;font-size:20px;font-weight:bold;letter-spacing:2px;color:#F4A523;">${key}</span>
      </div>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 22px;"><tr>
        <td style="padding-right:10px;"><a href="${site}" style="display:inline-block;background:#F4A523;color:#16181d;font-weight:bold;font-size:14px;text-decoration:none;padding:12px 20px;border-radius:10px;">Download for Windows</a></td>
        <td><a href="${app}" style="display:inline-block;background:#ffffff;color:#16181d;font-weight:bold;font-size:14px;text-decoration:none;padding:11px 20px;border-radius:10px;border:1px solid #d4d7dd;">Open in browser</a></td>
      </tr></table>
      <p style="margin:0 0 6px;font-size:15px;font-weight:bold;color:#16181d;">Getting started</p>
      <ol style="margin:0 0 18px;padding-left:18px;font-size:14px;line-height:1.7;color:#5b6270;">
        <li>Download for Windows from our site, or open it in your browser.</li>
        <li>Choose "Activate with a licence key" and create a password.</li>
        <li>Enter the licence key above.</li>
      </ol>
      <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#5b6270;">Your trial runs for <strong style="color:#16181d;">${trialDays} days</strong>. When it ends you'll get a friendly prompt in the app to set up payment if you'd like to keep going — no surprises.</p>
      <p style="margin:0;font-size:14px;line-height:1.6;color:#5b6270;">Any problems, just reply to this email.</p>
    </td></tr>
    <tr><td style="padding:16px 32px 26px;border-top:1px solid #eef0f3;">
      <p style="margin:0;font-size:12px;color:#9aa0ac;">GarageLY — budget-friendly garage management.</p>
    </td></tr>
  </table>
</div>`
}

async function sendInviteEmail(env: Env, to: string, key: string, trialDays: number): Promise<void> {
  const apiKey = env.RESEND_API_KEY
  const from = env.RESEND_FROM || 'GarageLY <info@getgaragely.com>'
  if (!apiKey || !to) throw new Error('Email not configured')
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [to],
      subject: 'Your GarageLY free trial invite',
      html: inviteEmailHtml(key, trialDays),
    }),
  })
  if (!res.ok) throw new Error(`Resend error ${res.status}`)
}

// ── admin-api ───────────────────────────────────────────────────────────────
async function adminApi(request: Request, env: Env, url: URL): Promise<Response> {
  const secret = request.headers.get('x-admin-secret')
  if (!secret || secret !== env.ADMIN_SECRET) return json(401, { error: 'Unauthorised' })

  const action = url.searchParams.get('action')
  const supabase = sb(env)

  // GET actions
  if (request.method === 'GET' && action === 'list-licences') {
    const status = url.searchParams.get('status')
    let query = supabase.from('licences').select('*').order('created_at', { ascending: false })
    if (status) query = query.eq('status', status)
    const { data, error } = await query
    if (error) return json(500, { error: error.message })
    return json(200, { licences: data })
  }

  if (request.method === 'GET' && action === 'get-licence') {
    const key = url.searchParams.get('key')
    if (!key) return json(400, { error: 'Missing key' })
    const { data, error } = await supabase.from('licences').select('*').eq('key', key).single()
    if (error || !data) return json(404, { error: 'Not found' })
    return json(200, { licence: data })
  }

  if (request.method === 'GET' && action === 'stats') {
    const { data, error } = await supabase.from('licences').select('status')
    if (error) return json(500, { error: error.message })
    const counts = { total: 0, active: 0, trial: 0, expired: 0, cancelled: 0 }
    for (const row of data || []) {
      counts.total++
      if (row.status in counts) counts[row.status as keyof typeof counts]++
    }
    return json(200, { stats: counts })
  }

  if (request.method === 'GET' && action === 'list-submissions') {
    const type = url.searchParams.get('type')
    const status = url.searchParams.get('status')
    let query = supabase.from('submissions').select('*, garages(name)').order('created_at', { ascending: false })
    if (type) query = query.eq('type', type)
    if (status) query = query.eq('status', status)
    const { data, error } = await query
    if (error) return json(500, { error: error.message })
    const submissions = (data || []).map((s: any) => ({ ...s, garage_name: s.garages?.name || null, garages: undefined }))
    return json(200, { submissions })
  }

  // POST actions
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed' })

  let body: any = {}
  try { body = await request.json() } catch { return json(400, { error: 'Invalid JSON' }) }

  if (action === 'create-trial') {
    const { email, garageName, trialDays } = body
    if (!email) return json(400, { error: 'email required' })
    const days = Number(trialDays) || Number(env.TRIAL_DAYS) || 14
    const trialEndsAt = new Date(Date.now() + days * 86400_000).toISOString()

    let key = generateLicenceKey()
    for (let i = 0; i < 5; i++) {
      const { error } = await supabase.from('licences').select('id').eq('key', key).single()
      if (error) break
      key = generateLicenceKey()
    }
    const { data, error } = await supabase.from('licences').insert({
      key, email, garage_name: garageName || 'My Garage', status: 'trial', trial_ends_at: trialEndsAt,
    }).select().single()
    if (error) return json(500, { error: error.message })
    return json(200, { licence: data })
  }

  if (action === 'update-licence') {
    const { key, status, garageName, trialEndsAt } = body
    if (!key) return json(400, { error: 'key required' })
    const updates: any = {}
    if (status) updates.status = status
    if (garageName) updates.garage_name = garageName
    if (trialEndsAt) updates.trial_ends_at = trialEndsAt
    const { data, error } = await supabase.from('licences').update(updates).eq('key', key).select().single()
    if (error) return json(500, { error: error.message })
    return json(200, { licence: data })
  }

  if (action === 'revoke-licence') {
    const { key } = body
    if (!key) return json(400, { error: 'key required' })
    const { error } = await supabase.from('licences').update({ status: 'cancelled' }).eq('key', key)
    if (error) return json(500, { error: error.message })
    return json(200, { success: true })
  }

  if (action === 'update-submission') {
    const { id, status } = body
    if (!id) return json(400, { error: 'id required' })
    if (!status) return json(400, { error: 'status required' })
    const { data, error } = await supabase.from('submissions').update({ status }).eq('id', id).select().single()
    if (error) return json(500, { error: error.message })
    return json(200, { submission: data })
  }

  // Send the branded trial-invite email (HTML) to a tester.
  if (action === 'send-invite') {
    const { email, key, trialDays } = body
    if (!email || !key) return json(400, { error: 'email and key required' })
    if (!env.RESEND_API_KEY)
      return json(400, { error: 'Email sending not set up yet (needs RESEND_API_KEY on the Worker).' })
    try {
      await sendInviteEmail(env, email, key, Number(trialDays) || 14)
      return json(200, { success: true, sent_to: email })
    } catch (e) {
      return json(502, { error: (e as Error).message || 'Failed to send invite' })
    }
  }

  // Re-send the licence key to the account email (uses the existing SendGrid setup).
  if (action === 'resend-key') {
    const { key } = body
    if (!key) return json(400, { error: 'key required' })
    const { data: lic, error } = await supabase.from('licences').select('*').eq('key', key).single()
    if (error || !lic) return json(404, { error: 'Licence not found' })
    if (!lic.email) return json(400, { error: 'No email on file for this licence' })
    if (!env.RESEND_API_KEY)
      return json(400, { error: 'Email not configured (RESEND_API_KEY).' })
    await sendLicenceEmail(env, lic.email, lic.key, lic.garage_name || 'your garage')
    return json(200, { success: true, sent_to: lic.email })
  }

  // Send a password-reset link to the account email. Returns the link too so the
  // admin can copy/paste it if email delivery isn't set up.
  if (action === 'reset-password') {
    const { key, email } = body
    let addr = email as string | undefined
    if (!addr && key) {
      const { data: lic } = await supabase.from('licences').select('email').eq('key', key).single()
      addr = lic?.email
    }
    if (!addr) return json(400, { error: 'email or key required' })
    const { data, error } = await supabase.auth.admin.generateLink({ type: 'recovery', email: addr })
    if (error) return json(500, { error: error.message })
    const link = (data as any)?.properties?.action_link || null
    if (env.RESEND_API_KEY && link) {
      await sendResetEmail(env, addr, link)
      return json(200, { success: true, emailed: true, sent_to: addr })
    }
    return json(200, { success: true, emailed: false, reset_link: link, sent_to: addr })
  }

  return json(400, { error: `Unknown action: ${action}` })
}

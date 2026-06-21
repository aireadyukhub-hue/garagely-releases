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
 *   SENDGRID_API_KEY            (secret) optional — licence emails
 *   SENDGRID_FROM               (var)    optional — verified sender address
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
  SENDGRID_API_KEY?: string
  SENDGRID_FROM?: string
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
        case 'create-checkout':    return await createCheckout(request, env)
        case 'get-key-by-session': return await getKeyBySession(request, env, url)
        case 'stripe-webhook':     return await stripeWebhook(request, env)
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
  const site = env.SITE_URL || 'https://garagely.pages.dev'
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
  const apiKey = env.SENDGRID_API_KEY
  const from = env.SENDGRID_FROM
  if (!apiKey || !from || !to) {
    console.log('Licence email skipped — SENDGRID_API_KEY / SENDGRID_FROM not configured')
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
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: from, name: 'GarageLY' },
        subject: 'Your GarageLY licence key — please save this email',
        content: [{ type: 'text/html', value: html }],
      }),
    })
    if (!res.ok) console.error('SendGrid error:', res.status, await res.text())
  } catch (err) {
    console.error('Licence email failed:', (err as Error).message)
  }
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

  return json(400, { error: `Unknown action: ${action}` })
}

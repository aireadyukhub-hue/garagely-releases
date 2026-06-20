import { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

// Service-role client — bypasses RLS so it can provision accounts + seed data.
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (statusCode: number, body: unknown) => ({
  statusCode,
  headers: { ...CORS, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

const KEY_RE = /^GRLY-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' }
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' })

  // ── Parse + validate input ──────────────────────────────────────────────
  let key = ''
  let email = ''
  let password = ''
  let garageName: string | undefined
  try {
    const b = JSON.parse(event.body || '{}')
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

  // ── Validate the licence ────────────────────────────────────────────────
  const { data: licence, error: licErr } = await supabase
    .from('licences')
    .select('*')
    .eq('key', key)
    .single()

  if (licErr || !licence) return json(200, { error: 'Licence key not found.' })

  if (licence.status === 'expired' || licence.status === 'cancelled') {
    return json(200, { error: 'This licence is no longer active.' })
  }
  if (licence.status === 'trial' && licence.trial_ends_at && new Date(licence.trial_ends_at) < new Date()) {
    await supabase.from('licences').update({ status: 'expired' }).eq('id', licence.id)
    return json(200, { error: 'Trial period has ended. Please subscribe to continue.' })
  }

  // ── Already activated? ──────────────────────────────────────────────────
  const { data: existingGarage } = await supabase
    .from('garages')
    .select('id')
    .eq('licence_key', key)
    .maybeSingle()
  if (existingGarage) {
    return json(200, {
      error: 'This licence is already linked to an account. Please sign in instead.',
    })
  }

  // ── Create the auth user ────────────────────────────────────────────────
  const { data: created, error: userErr } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (userErr || !created?.user) {
    const msg = /already.*registered|exists/i.test(userErr?.message || '')
      ? 'An account with this email already exists. Please sign in instead.'
      : userErr?.message || 'Could not create the account.'
    return json(200, { error: msg })
  }
  const userId = created.user.id

  // Best-effort cleanup if any later step fails (avoid orphaned user).
  const rollback = async () => {
    await supabase.auth.admin.deleteUser(userId).catch(() => {})
  }

  // ── Create garage + membership ──────────────────────────────────────────
  const { data: garage, error: gErr } = await supabase
    .from('garages')
    .insert({ name: garageName || licence.garage_name || 'My Garage', licence_key: key, is_demo: true })
    .select('id')
    .single()
  if (gErr || !garage) {
    await rollback()
    return json(500, { error: 'Could not create garage record.' })
  }

  const { error: mErr } = await supabase
    .from('garage_members')
    .insert({ user_id: userId, garage_id: garage.id, role: 'owner' })
  if (mErr) {
    await supabase.from('garages').delete().eq('id', garage.id)
    await rollback()
    return json(500, { error: 'Could not link account to garage.' })
  }

  // ── Seed demo data (non-fatal if it fails) ──────────────────────────────
  const { error: seedErr } = await supabase.rpc('seed_demo_data', { g: garage.id })
  if (seedErr) console.error('seed_demo_data failed:', seedErr.message)

  await supabase.from('activation_log').insert({
    licence_id: licence.id,
    event: 'account_activated',
    metadata: { email, garage_id: garage.id, ip: event.headers['x-forwarded-for'] || 'unknown' },
  })

  return json(200, { success: true, garageId: garage.id })
}

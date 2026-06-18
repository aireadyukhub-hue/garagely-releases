/**
 * GarageLY Admin API
 * All endpoints require the X-Admin-Secret header matching ADMIN_SECRET env var.
 *
 * Routes (via ?action=...):
 *   GET  ?action=list-licences          — list all licences (with optional ?status= filter)
 *   GET  ?action=get-licence&key=...    — get single licence
 *   POST ?action=create-trial           — create a free-trial licence manually
 *   POST ?action=update-licence         — update status / garageName
 *   POST ?action=revoke-licence         — set status=cancelled
 *   GET  ?action=stats                  — dashboard stats
 */

import { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Secret',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

function generateLicenceKey(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const seg = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  return `GRLY-${seg()}-${seg()}-${seg()}`
}

function authError() {
  return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Unauthorised' }) }
}

function badRequest(msg: string) {
  return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: msg }) }
}

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' }

  // Auth check
  const secret = event.headers['x-admin-secret']
  if (!secret || secret !== process.env.ADMIN_SECRET) return authError()

  const action = event.queryStringParameters?.action

  // ── GET: list-licences ────────────────────────────────────────────────────
  if (event.httpMethod === 'GET' && action === 'list-licences') {
    const status = event.queryStringParameters?.status
    let query = supabase.from('licences').select('*').order('created_at', { ascending: false })
    if (status) query = query.eq('status', status)
    const { data, error } = await query
    if (error) return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: error.message }) }
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ licences: data }) }
  }

  // ── GET: get-licence ──────────────────────────────────────────────────────
  if (event.httpMethod === 'GET' && action === 'get-licence') {
    const key = event.queryStringParameters?.key
    if (!key) return badRequest('Missing key')
    const { data, error } = await supabase.from('licences').select('*').eq('key', key).single()
    if (error || !data) return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'Not found' }) }
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ licence: data }) }
  }

  // ── GET: stats ────────────────────────────────────────────────────────────
  if (event.httpMethod === 'GET' && action === 'stats') {
    const { data, error } = await supabase.from('licences').select('status')
    if (error) return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: error.message }) }
    const counts = { total: 0, active: 0, trial: 0, expired: 0, cancelled: 0 }
    for (const row of (data || [])) {
      counts.total++
      if (row.status in counts) counts[row.status as keyof typeof counts]++
    }
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ stats: counts }) }
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  let body: any = {}
  try { body = JSON.parse(event.body || '{}') } catch { return badRequest('Invalid JSON') }

  // ── POST: create-trial ────────────────────────────────────────────────────
  if (action === 'create-trial') {
    const { email, garageName, trialDays } = body
    if (!email) return badRequest('email required')

    const days = Number(trialDays) || Number(process.env.TRIAL_DAYS) || 14
    const trialEndsAt = new Date(Date.now() + days * 86400_000).toISOString()

    let key = generateLicenceKey()
    // ensure uniqueness
    for (let i = 0; i < 5; i++) {
      const { error } = await supabase.from('licences').select('id').eq('key', key).single()
      if (error) break
      key = generateLicenceKey()
    }

    const { data, error } = await supabase.from('licences').insert({
      key,
      email,
      garage_name: garageName || 'My Garage',
      status: 'trial',
      trial_ends_at: trialEndsAt,
    }).select().single()

    if (error) return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: error.message }) }
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ licence: data }) }
  }

  // ── POST: update-licence ──────────────────────────────────────────────────
  if (action === 'update-licence') {
    const { key, status, garageName, trialEndsAt } = body
    if (!key) return badRequest('key required')

    const updates: any = {}
    if (status) updates.status = status
    if (garageName) updates.garage_name = garageName
    if (trialEndsAt) updates.trial_ends_at = trialEndsAt

    const { data, error } = await supabase
      .from('licences')
      .update(updates)
      .eq('key', key)
      .select()
      .single()

    if (error) return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: error.message }) }
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ licence: data }) }
  }

  // ── POST: revoke-licence ──────────────────────────────────────────────────
  if (action === 'revoke-licence') {
    const { key } = body
    if (!key) return badRequest('key required')

    const { error } = await supabase.from('licences').update({ status: 'cancelled' }).eq('key', key)
    if (error) return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: error.message }) }
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ success: true }) }
  }

  return badRequest(`Unknown action: ${action}`)
}

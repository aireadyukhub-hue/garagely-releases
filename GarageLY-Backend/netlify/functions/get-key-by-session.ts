/**
 * Retrieves a licence key by Stripe checkout session ID.
 * Called by the success page after checkout to display the key to the user.
 *
 * GET ?session_id=cs_live_xxx
 * Returns: { key: string, email: string } or { error: string }
 */

import { Handler } from '@netlify/functions'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' })
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' }
  if (event.httpMethod !== 'GET') return { statusCode: 405, headers: CORS, body: 'Method not allowed' }

  const sessionId = event.queryStringParameters?.session_id
  if (!sessionId) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'session_id required' }) }
  }

  // Verify the session with Stripe (ensures it's a real, completed session)
  let email: string
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    if (!session.customer_email && !session.customer_details?.email) {
      return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'Session email not found' }) }
    }
    email = (session.customer_email || session.customer_details?.email) as string
  } catch {
    return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'Invalid session' }) }
  }

  // Look up the licence in Supabase by email.
  // NOTE: the column is `key`, not `licence_key` (this mismatch was the bug
  // that left the success page stuck on "Key not ready yet").
  const { data, error } = await supabase
    .from('licences')
    .select('key, email, status, trial_ends_at')
    .eq('email', email.toLowerCase())
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) {
    // Key may not be created yet (webhook delay) — return 202 so client can retry
    return {
      statusCode: 202,
      headers: CORS,
      body: JSON.stringify({ error: 'Key not ready yet', retry: true }),
    }
  }

  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({ key: data.key, email: data.email, status: data.status }),
  }
}

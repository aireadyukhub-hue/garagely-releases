import { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' }
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  let key: string
  try {
    const body = JSON.parse(event.body || '{}')
    key = (body.key || '').trim().toUpperCase()
  } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ valid: false, error: 'Invalid request body' }) }
  }

  if (!key) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ valid: false, error: 'No licence key provided' }) }
  }

  const { data, error } = await supabase
    .from('licences')
    .select('*')
    .eq('key', key)
    .single()

  if (error || !data) {
    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ valid: false, error: 'Licence key not found' }),
    }
  }

  // Check trial expiry
  if (data.status === 'trial' && data.trial_ends_at) {
    if (new Date(data.trial_ends_at) < new Date()) {
      // Trial expired — update status
      await supabase.from('licences').update({ status: 'expired' }).eq('id', data.id)
      return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify({ valid: false, status: 'expired', error: 'Trial period has ended. Please subscribe to continue.' }),
      }
    }
  }

  if (data.status === 'expired' || data.status === 'cancelled') {
    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ valid: false, status: data.status, error: 'Subscription is no longer active.' }),
    }
  }

  // Log validation
  await supabase.from('activation_log').insert({
    licence_id: data.id,
    event: 'validation_ok',
    metadata: { ip: event.headers['x-forwarded-for'] || 'unknown' },
  })

  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({
      valid: true,
      status: data.status,
      garageName: data.garage_name,
      trialEndsAt: data.trial_ends_at,
      currentPeriodEnd: data.current_period_end,
    }),
  }
}

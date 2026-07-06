/**
 * Creates a Stripe Checkout session.
 * The GarageDash marketing site calls this when someone clicks "Start Free Trial".
 *
 * POST body: { email: string, garageName: string }
 * Returns:   { url: string }  — redirect the user to this URL
 */

import { Handler } from '@netlify/functions'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' })

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' }
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: 'Method not allowed' }

  let email: string, garageName: string
  try {
    const body = JSON.parse(event.body || '{}')
    email = body.email?.trim()
    garageName = body.garageName?.trim() || 'My Garage'
  } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid request' }) }
  }

  if (!email) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'email required' }) }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    customer_email: email,
    line_items: [
      {
        price: process.env.STRIPE_PRICE_ID!,
        quantity: 1,
      },
    ],
    subscription_data: {
      trial_period_days: Number(process.env.TRIAL_DAYS) || 14,
      metadata: { garage_name: garageName, email },
    },
    metadata: { garage_name: garageName, email },
    success_url: `${process.env.SITE_URL || 'https://garagely.netlify.app'}/success.html?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.SITE_URL || 'https://garagely.netlify.app'}/#pricing`,
  })

  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({ url: session.url }),
  }
}

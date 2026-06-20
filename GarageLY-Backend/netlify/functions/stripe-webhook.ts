import { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' })
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function generateLicenceKey(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const seg = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  return `GRLY-${seg()}-${seg()}-${seg()}`
}

/**
 * Email the licence key to the customer via SendGrid.
 * No-ops (logs) if SENDGRID_API_KEY / SENDGRID_FROM aren't configured, so the
 * webhook never fails just because email isn't set up yet.
 */
async function sendLicenceEmail(to: string, key: string, garageName: string): Promise<void> {
  const apiKey = process.env.SENDGRID_API_KEY
  const from = process.env.SENDGRID_FROM
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
      <p><strong>To get started:</strong></p>
      <ol>
        <li>Download GarageLY from <a href="https://garagely.netlify.app">garagely.netlify.app</a> (or use it in your browser at <a href="https://garagely-app.netlify.app">garagely-app.netlify.app</a>).</li>
        <li>Open it and choose <strong>Activate licence</strong>.</li>
        <li>Enter this key plus your email and a password — you're in.</li>
      </ol>
      <p style="color:#888;font-size:13px">Need help? Reply to this email or contact support@garagely.co.uk</p>
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
    else console.log(`Licence email sent to ${to}`)
  } catch (err) {
    console.error('Licence email failed:', (err as Error).message)
  }
}

export const handler: Handler = async (event) => {
  const sig = event.headers['stripe-signature']
  if (!sig) return { statusCode: 400, body: 'No signature' }

  let stripeEvent: Stripe.Event
  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body || '',
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err: any) {
    console.error('Webhook signature failed:', err.message)
    return { statusCode: 400, body: `Webhook Error: ${err.message}` }
  }

  const data = stripeEvent.data.object as any

  switch (stripeEvent.type) {
    // ── New subscription created (checkout completed) ──────────────────────
    case 'checkout.session.completed': {
      const session = data as Stripe.Checkout.Session
      const email = session.customer_details?.email || session.metadata?.email || ''
      const garageName = session.metadata?.garage_name || 'My Garage'
      const subscriptionId = session.subscription as string
      const customerId = session.customer as string

      // Retrieve subscription to get period end
      const sub = await stripe.subscriptions.retrieve(subscriptionId)
      const periodEnd = new Date(sub.current_period_end * 1000).toISOString()

      // Generate unique key
      let key = generateLicenceKey()
      let attempts = 0
      while (attempts < 5) {
        const existing = await supabase.from('licences').select('id').eq('key', key).single()
        if (existing.error) break // No match — key is unique
        key = generateLicenceKey()
        attempts++
      }

      const { error } = await supabase.from('licences').insert({
        key,
        email,
        garage_name: garageName,
        status: 'active',
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        current_period_end: periodEnd,
      })

      if (error) {
        console.error('Failed to create licence:', error)
        return { statusCode: 500, body: 'Database error' }
      }

      console.log(`New licence created: ${key} for ${email}`)
      await sendLicenceEmail(email, key, garageName)
      break
    }

    // ── Free trial signup (create licence with trial status) ───────────────
    case 'customer.subscription.trial_will_end': {
      // Reminder that trial ends in 3 days — handled here if needed
      break
    }

    // ── Payment succeeded — extend subscription ────────────────────────────
    case 'invoice.payment_succeeded': {
      const invoice = data as Stripe.Invoice
      const subscriptionId = invoice.subscription as string
      const sub = await stripe.subscriptions.retrieve(subscriptionId)
      const periodEnd = new Date(sub.current_period_end * 1000).toISOString()

      await supabase
        .from('licences')
        .update({ status: 'active', current_period_end: periodEnd })
        .eq('stripe_subscription_id', subscriptionId)
      break
    }

    // ── Payment failed ─────────────────────────────────────────────────────
    case 'invoice.payment_failed': {
      const invoice = data as Stripe.Invoice
      const subscriptionId = invoice.subscription as string
      // Don't expire immediately — Stripe will retry; just log
      console.warn(`Payment failed for subscription: ${subscriptionId}`)
      break
    }

    // ── Subscription cancelled ─────────────────────────────────────────────
    case 'customer.subscription.deleted': {
      const sub = data as Stripe.Subscription
      await supabase
        .from('licences')
        .update({ status: 'cancelled' })
        .eq('stripe_subscription_id', sub.id)
      break
    }

    // ── Subscription updated (e.g. plan change, renewal) ──────────────────
    case 'customer.subscription.updated': {
      const sub = data as Stripe.Subscription
      const periodEnd = new Date(sub.current_period_end * 1000).toISOString()
      const status = sub.status === 'active' ? 'active'
        : sub.status === 'trialing' ? 'trial'
        : sub.status === 'canceled' ? 'cancelled'
        : 'expired'

      await supabase
        .from('licences')
        .update({ status, current_period_end: periodEnd })
        .eq('stripe_subscription_id', sub.id)
      break
    }
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) }
}

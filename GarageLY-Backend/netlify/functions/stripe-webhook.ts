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

      // TODO: Send the key via email (add SendGrid/Postmark here)
      // await sendLicenceEmail(email, key, garageName)
      console.log(`New licence created: ${key} for ${email}`)
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

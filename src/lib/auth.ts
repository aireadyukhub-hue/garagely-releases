// Auth + account provisioning. One Supabase Auth account (email + password)
// works on both desktop and web; the licence key links to it at activation.

import { supabase, clearGarageId } from './supabase'
import { clearCache } from './cache'

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL || 'https://garagely-backend.netlify.app'

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  })
  if (error) throw new Error(error.message)
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut()
  clearGarageId()
  clearCache()
}

/**
 * Activate a licence and create the linked account in one step.
 * The backend validates the key, creates the Supabase Auth user, the garage,
 * the membership, and seeds demo data. Then we sign the user in.
 */
export async function activateAccount(params: {
  key: string
  email: string
  password: string
  garageName?: string
}): Promise<void> {
  const res = await fetch(`${BACKEND_URL}/.netlify/functions/activate-account`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      key: params.key.trim().toUpperCase(),
      email: params.email.trim(),
      password: params.password,
      garageName: params.garageName?.trim() || undefined,
    }),
  })
  let data: { success?: boolean; error?: string } = {}
  try {
    data = await res.json()
  } catch {
    throw new Error('Could not reach the activation server. Check your connection.')
  }
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Activation failed. Please try again.')
  }
  await signIn(params.email, params.password)
}

export async function getSessionUserEmail(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.user.email ?? null
}

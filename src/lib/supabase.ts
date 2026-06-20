import { createClient } from '@supabase/supabase-js'

// Vite injects these at build time (see .env). The anon key is safe to ship in
// the client because Row Level Security protects every table — it's the same
// public key already visible in the deployed web bundle. The hardcoded values
// are fallbacks so CI/release builds work even without a local .env; a .env
// (or Netlify env var) still overrides them.
const url =
  (import.meta.env.VITE_SUPABASE_URL as string) ||
  'https://ulrsthmkgsyfeloihens.supabase.co'
const anonKey =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string) ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVscnN0aG1rZ3N5ZmVsb2loZW5zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4MDA0NjQsImV4cCI6MjA5NzM3NjQ2NH0.68fms-36Y6bXq8HJUaBGPtwVS2Yh1RdRFn37R24m7XM'

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
})

// ── Current garage id ────────────────────────────────────────────────────────
// Resolved once per session from garage_members and memoised. Used to stamp
// garage_id on direct inserts (RPC creates set it server-side themselves).
let _garageId: number | null = null

export async function getGarageId(): Promise<number> {
  if (_garageId != null) return _garageId
  const { data, error } = await supabase
    .from('garage_members')
    .select('garage_id')
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('No garage is linked to this account.')
  _garageId = data.garage_id as number
  return _garageId
}

export function clearGarageId(): void {
  _garageId = null
}

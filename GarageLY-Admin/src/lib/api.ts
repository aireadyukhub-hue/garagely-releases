// All calls go through the GarageLY-Backend admin-api Netlify function.
// The admin secret is stored in localStorage (set on login).

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'https://garagely-backend.garagely.workers.dev'

function getSecret(): string {
  return localStorage.getItem('admin_secret') || ''
}

async function request(
  method: 'GET' | 'POST',
  action: string,
  body?: object,
  extraParams?: Record<string, string>
) {
  const params = new URLSearchParams({ action, ...extraParams })
  const url = `${BACKEND}/.netlify/functions/admin-api?${params}`

  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Secret': getSecret(),
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (res.status === 401) throw new Error('Unauthorised — wrong admin password')
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
  return json
}

export const api = {
  getStats: () => request('GET', 'stats'),
  listLicences: (status?: string) =>
    request('GET', 'list-licences', undefined, status ? { status } : {}),
  getLicence: (key: string) =>
    request('GET', 'get-licence', undefined, { key }),
  createTrial: (email: string, garageName: string, trialDays = 14) =>
    request('POST', 'create-trial', { email, garageName, trialDays }),
  updateLicence: (key: string, updates: { status?: string; garageName?: string; trialEndsAt?: string }) =>
    request('POST', 'update-licence', { key, ...updates }),
  revokeLicence: (key: string) =>
    request('POST', 'revoke-licence', { key }),
  resendKey: (key: string) =>
    request('POST', 'resend-key', { key }),
  resetPassword: (key: string) =>
    request('POST', 'reset-password', { key }),
  listSubmissions: (filters?: { type?: string; status?: string }) =>
    request('GET', 'list-submissions', undefined, {
      ...(filters?.type ? { type: filters.type } : {}),
      ...(filters?.status ? { status: filters.status } : {}),
    }),
  updateSubmission: (id: number, status: string) =>
    request('POST', 'update-submission', { id, status }),
}

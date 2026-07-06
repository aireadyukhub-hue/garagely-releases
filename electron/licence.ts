import path from 'path'
import fs from 'fs'
import https from 'https'

// Backend URL — swap to production URL when live
export const BACKEND_URL = process.env.GARAGELY_BACKEND_URL || 'https://garagely-backend.garagely.workers.dev'

export interface LicenceInfo {
  key: string
  garageName: string
  status: 'active' | 'trial' | 'expired' | 'invalid'
  trialEndsAt?: string
  activatedAt: string
}

let _licencePath: string | null = null

export function initLicencePath(userDataPath: string): void {
  _licencePath = path.join(userDataPath, 'licence.json')
}

export function getLicencePath(): string {
  if (!_licencePath) throw new Error('Licence path not initialised')
  return _licencePath
}

export function readLocalLicence(): LicenceInfo | null {
  const p = getLicencePath()
  if (!fs.existsSync(p)) return null
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8')) as LicenceInfo
  } catch {
    return null
  }
}

export function saveLocalLicence(info: LicenceInfo): void {
  fs.writeFileSync(getLicencePath(), JSON.stringify(info, null, 2))
}

export function clearLocalLicence(): void {
  const p = getLicencePath()
  if (fs.existsSync(p)) fs.unlinkSync(p)
}

/** Call backend to validate/activate a licence key. */
export function validateWithBackend(key: string): Promise<{
  valid: boolean
  status?: LicenceInfo['status']
  garageName?: string
  trialEndsAt?: string
  error?: string
}> {
  return new Promise((resolve) => {
    const body = JSON.stringify({ key })
    const url = new URL(`${BACKEND_URL}/.netlify/functions/validate-licence`)

    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }

    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => (data += chunk))
      res.on('end', () => {
        try {
          resolve(JSON.parse(data))
        } catch {
          resolve({ valid: false, error: 'Invalid response from server' })
        }
      })
    })

    req.on('error', () => {
      // If we can't reach the server, trust the local copy for up to 7 days
      resolve({ valid: false, error: 'offline' })
    })

    req.setTimeout(8000, () => {
      req.destroy()
      resolve({ valid: false, error: 'offline' })
    })

    req.write(body)
    req.end()
  })
}

/**
 * Full startup check:
 * 1. Try to validate with backend
 * 2. Fall back to local licence if offline (grace period)
 * Returns the current LicenceInfo or null if not activated
 */
export async function checkLicenceOnStartup(): Promise<LicenceInfo | null> {
  const local = readLocalLicence()

  if (!local) return null

  const result = await validateWithBackend(local.key)

  if (result.error === 'offline') {
    // Offline grace: trust local licence for up to 7 days
    const lastCheck = new Date(local.activatedAt)
    const daysSince = (Date.now() - lastCheck.getTime()) / (1000 * 60 * 60 * 24)
    if (daysSince > 7) return null
    return local
  }

  if (!result.valid || result.status === 'expired' || result.status === 'invalid') {
    clearLocalLicence()
    return null
  }

  // Update local copy with fresh data from backend
  const updated: LicenceInfo = {
    key: local.key,
    garageName: result.garageName || local.garageName,
    status: result.status || local.status,
    trialEndsAt: result.trialEndsAt,
    activatedAt: new Date().toISOString(),
  }
  saveLocalLicence(updated)
  return updated
}

export async function activateLicence(key: string): Promise<{
  success: boolean
  licence?: LicenceInfo
  error?: string
}> {
  const trimmed = key.trim().toUpperCase()

  // Basic format check: GDSH-XXXX-XXXX-XXXX (legacy GRLY- keys remain valid)
  if (!/^(?:GRLY|GDSH)-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(trimmed)) {
    return { success: false, error: 'Invalid licence key format. Expected: GDSH-XXXX-XXXX-XXXX' }
  }

  const result = await validateWithBackend(trimmed)

  if (result.error === 'offline') {
    return { success: false, error: 'Cannot reach activation server. Please check your internet connection.' }
  }

  if (!result.valid) {
    return { success: false, error: result.error || 'Licence key not found or already used on another device.' }
  }

  const info: LicenceInfo = {
    key: trimmed,
    garageName: result.garageName || 'My Garage',
    status: result.status || 'active',
    trialEndsAt: result.trialEndsAt,
    activatedAt: new Date().toISOString(),
  }

  saveLocalLicence(info)
  return { success: true, licence: info }
}

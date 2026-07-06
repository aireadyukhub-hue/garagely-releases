// Technician Mode: a simple, non-auth "restricted view" for shared workshop
// devices. No separate login — the owner sets a PIN once in Settings, then
// any device can be flipped into Technician Mode from the sidebar. The
// on/off state is per-device (localStorage), so the workshop tablet can stay
// in Technician Mode while the owner's own laptop stays in the full view.
// Leaving Technician Mode requires the PIN, so a technician can't just
// toggle it off themselves.

const KEY = 'garagely_tech_mode'
export const TECH_MODE_EVENT = 'garagely-tech-mode-changed'

// Paths a technician needs day-to-day: bookings, job sheets, customers,
// vehicles, and inspection sheets. Everything else (Dashboard, Reports,
// Settings, pricing, Suppliers, etc.) is hidden.
export const TECH_ALLOWED_PREFIXES = ['/calendar', '/jobs', '/customers', '/vehicles', '/inspections']

export function isTechModeOn(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export function enterTechMode() {
  try { localStorage.setItem(KEY, '1') } catch { /* ignore */ }
  window.dispatchEvent(new Event(TECH_MODE_EVENT))
}

export function exitTechMode() {
  try { localStorage.removeItem(KEY) } catch { /* ignore */ }
  window.dispatchEvent(new Event(TECH_MODE_EVENT))
}

export function isPathAllowedInTechMode(pathname: string): boolean {
  return TECH_ALLOWED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))
}

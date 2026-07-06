// Online-first read cache. Every successful read is stored in localStorage;
// if a later read fails (e.g. offline) we serve the last known value so the
// app stays viewable. Writes are NOT cached/queued — they require a connection.

const PREFIX = 'gly_cache_'

export async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  try {
    const res = await fn()
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(res))
    } catch {
      /* quota / private mode — ignore */
    }
    return res
  } catch (err) {
    try {
      const c = localStorage.getItem(PREFIX + key)
      if (c != null) {
        console.warn('[GarageDash offline] serving cached:', key)
        return JSON.parse(c) as T
      }
    } catch {
      /* ignore */
    }
    throw err
  }
}

export function clearCache(): void {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(PREFIX))
      .forEach((k) => localStorage.removeItem(k))
  } catch {
    /* ignore */
  }
}

/** True when the browser reports no network. UI can use this for a banner. */
export function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

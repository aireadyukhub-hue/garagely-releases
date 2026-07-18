// UK vehicle registration (VRM) extraction from free text.
// Setmore/Square have no vehicle fields, so garages put the reg in appointment
// titles/notes ("MOT - AB12 CDE", "Ford Focus WV58 XYZ brakes"). We pull them
// out so the importer can rebuild the vehicle database via the DVSA lookup.

// Formats covered:
//  • Current (2001+):  AB12 CDE / AB12CDE
//  • Prefix (1983-01): A123 BCD
//  • Suffix (1963-83): ABC 123D
//  • Dateless:         ABC 123 / 123 ABC (also NI: ABZ 1234)
const PATTERNS = [
  /\b([A-Z]{2}[0-9]{2})\s?([A-Z]{3})\b/g, // current
  /\b([A-Z])([0-9]{1,3})\s?([A-Z]{3})\b/g, // prefix
  /\b([A-Z]{3})\s?([0-9]{1,3})([A-Z])\b/g, // suffix
  /\b([A-Z]{1,3})\s?([0-9]{1,4})\b/g, // dateless / NI (most false-positive-prone, last)
]

// Words that regex-match the current format but are never plates.
const STOPLIST = new Set([
  'MOT', 'VAT', 'AND', 'THE', 'FOR', 'NEW', 'CAR', 'VAN', 'KIT', 'OIL',
])

// Common 3-letter words — if the letter block of a prefix/suffix-style match is
// one of these, it's text like "x2 New", not a plate ("A123 BCD" is fine).
const WORDS3 = new Set([
  'AND', 'THE', 'FOR', 'NEW', 'CAR', 'VAN', 'KIT', 'OIL', 'MOT', 'VAT', 'ALL',
  'ANY', 'ARE', 'BUT', 'CAN', 'DAY', 'DUE', 'FIT', 'GET', 'HAS', 'HER', 'HIM',
  'HIS', 'HOW', 'ITS', 'JOB', 'LET', 'LOW', 'MAN', 'MAY', 'MRS', 'NOT', 'NOW',
  'OLD', 'ONE', 'OUR', 'OUT', 'OWN', 'PER', 'PUT', 'RUN', 'SAT', 'SET', 'SUN',
  'TAX', 'TEN', 'TOP', 'TRY', 'TWO', 'USE', 'WAS', 'WAY', 'WHO', 'WHY', 'YES',
  'YET', 'YOU', 'BAY', 'PRE', 'KEY', 'BAD', 'BIG', 'RED', 'VVT', 'ABS', 'EGR',
  'DPF', 'ECU', 'AIR', 'LED', 'ALT', 'CAM', 'FAN', 'TOW', 'BAR',
])

/** Normalise a candidate: uppercase, no spaces. */
export function normaliseVrm(v: string): string {
  return v.toUpperCase().replace(/\s+/g, '')
}

/** Format for display: AB12CDE → AB12 CDE (current style only). */
export function formatVrm(v: string): string {
  const n = normaliseVrm(v)
  const m = /^([A-Z]{2}[0-9]{2})([A-Z]{3})$/.exec(n)
  return m ? `${m[1]} ${m[2]}` : n
}

/**
 * Extract likely VRMs from a blob of text. Conservative by default: the
 * dateless pattern is only used when `aggressive` is true because it matches
 * things like "BAY 3" and "JOB 12".
 */
export function extractVrms(text: string, aggressive = false): string[] {
  if (!text) return []
  const upper = text.toUpperCase()
  const found = new Set<string>()
  const patterns = aggressive ? PATTERNS : PATTERNS.slice(0, 3)
  patterns.forEach((re, pi) => {
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(upper))) {
      const raw = m[0].replace(/\s+/g, '')
      if (raw.length < 5 || raw.length > 7) continue
      if (STOPLIST.has(raw)) continue
      if (!/[0-9]/.test(raw)) continue
      // prefix format ("A123 BCD"): reject if the letter block is a real word
      if (pi === 1 && WORDS3.has(m[3])) continue
      // suffix format ("ABC 123D"): same for the leading block
      if (pi === 2 && WORDS3.has(m[1])) continue
      found.add(raw)
    }
  })
  return [...found]
}

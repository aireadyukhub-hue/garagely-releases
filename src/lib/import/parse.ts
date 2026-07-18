// File parsing for the Import wizard.
// Accepts .csv, .xls, .xlsx (Setmore appointment reports export as .XLS).
// Everything returns a uniform ParsedTable so the rest of the wizard doesn't
// care what the source file was.

import * as XLSX from 'xlsx'

export interface ParsedTable {
  fileName: string
  headers: string[]
  rows: string[][] // same length as headers, cells trimmed
}

// ── CSV ──────────────────────────────────────────────────────────────────────
// Small RFC-4180-ish parser: quoted fields, escaped quotes, commas/newlines in
// quotes, CRLF, BOM. No dependency needed.
export function parseCsv(text: string): string[][] {
  const out: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text // strip BOM
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++ } else inQuotes = false
      } else cell += c
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      row.push(cell); cell = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++
      row.push(cell); cell = ''
      // skip fully empty trailing rows
      if (row.some((v) => v.trim() !== '')) out.push(row)
      row = []
    } else cell += c
  }
  row.push(cell)
  if (row.some((v) => v.trim() !== '')) out.push(row)
  return out
}

// ── Entry point ──────────────────────────────────────────────────────────────
export async function parseFile(file: File): Promise<ParsedTable> {
  const name = file.name.toLowerCase()
  let grid: string[][]

  if (name.endsWith('.csv') || name.endsWith('.tsv') || name.endsWith('.txt')) {
    let text = await file.text()
    if (name.endsWith('.tsv') || (text.includes('\t') && !text.includes(','))) {
      // naive TSV → reuse CSV parser by swapping delimiters outside quotes is
      // overkill; TSV files practically never quote, so split directly.
      grid = text
        .replace(/^﻿/, '')
        .split(/\r?\n/)
        .filter((l) => l.trim() !== '')
        .map((l) => l.split('\t'))
    } else {
      grid = parseCsv(text)
    }
  } else {
    // .xls / .xlsx / anything else → let SheetJS figure it out. This also
    // handles "fake" .xls files that are really HTML tables (some exporters,
    // including several booking tools, do this).
    const buf = await file.arrayBuffer()
    let wb: XLSX.WorkBook
    try {
      wb = XLSX.read(buf, { type: 'array', cellDates: true })
    } catch {
      // Possibly an HTML table saved as .xls — retry as text.
      const text = new TextDecoder().decode(buf)
      wb = XLSX.read(text, { type: 'string', cellDates: true })
    }
    const sheet = wb.Sheets[wb.SheetNames[0]]
    if (!sheet) throw new Error('No sheets found in file')
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      raw: false, // formatted strings — keeps dates readable, we re-parse later
      defval: '',
    })
    grid = (aoa as unknown[][])
      .map((r) => r.map((c) => (c == null ? '' : String(c))))
      .filter((r) => r.some((v) => v.trim() !== ''))
  }

  if (!grid.length) throw new Error('File appears to be empty')

  // Header row = first row with ≥2 non-empty cells (report exports sometimes
  // have a title row above the real headers).
  let headerIdx = 0
  for (let i = 0; i < Math.min(grid.length, 10); i++) {
    const nonEmpty = grid[i].filter((v) => v.trim() !== '').length
    if (nonEmpty >= 2) { headerIdx = i; break }
  }

  const headers = grid[headerIdx].map((h) => h.trim())
  const width = headers.length
  const rows = grid.slice(headerIdx + 1).map((r) => {
    const row = r.slice(0, width).map((v) => (v ?? '').trim())
    while (row.length < width) row.push('')
    return row
  })

  return { fileName: file.name, headers, rows }
}

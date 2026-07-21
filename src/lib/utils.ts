import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, parseISO, isValid } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency = 'GBP'): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
  }).format(amount)
}

export function formatDate(date: string | null | undefined, fmt = 'dd MMM yyyy'): string {
  if (!date) return '—'
  try {
    const d = parseISO(date)
    if (!isValid(d)) return '—'
    return format(d, fmt)
  } catch {
    return '—'
  }
}

export function formatDateTime(date: string | null | undefined): string {
  return formatDate(date, 'dd MMM yyyy HH:mm')
}

export function isOverdue(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false
  try {
    return parseISO(dateStr) < new Date()
  } catch {
    return false
  }
}

export function isDueSoon(dateStr: string | null | undefined, days = 30): boolean {
  if (!dateStr) return false
  try {
    const d = parseISO(dateStr)
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() + days)
    return d <= cutoff && d >= new Date()
  } catch {
    return false
  }
}

export const JOB_STATUS_LABELS: Record<string, string> = {
  booked: 'Booked',
  in_progress: 'In Progress',
  awaiting_parts: 'Awaiting Parts',
  complete: 'Complete',
  invoiced: 'Invoiced',
}

export const JOB_STATUS_COLORS: Record<string, string> = {
  booked: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  in_progress: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  awaiting_parts: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  complete: 'bg-green-500/20 text-green-400 border-green-500/30',
  invoiced: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
}

export const INVOICE_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  sent: 'Sent',
  unpaid: 'Unpaid',
  paid: 'Paid',
  overdue: 'Overdue',
}

export const INVOICE_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
  sent: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  unpaid: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  paid: 'bg-green-500/20 text-green-400 border-green-500/30',
  overdue: 'bg-red-500/20 text-red-400 border-red-500/30',
}

export const QUOTE_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
  sent: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  accepted: 'bg-green-500/20 text-green-400 border-green-500/30',
  rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
  converted: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
}

/** Deposit owed for a job/preset given its total value (ex VAT). */
export function depositAmount(
  deposit: { deposit_required?: boolean; deposit_type?: 'fixed' | 'percent'; deposit_value?: number },
  total: number,
): number {
  if (!deposit.deposit_required) return 0
  const val = Number(deposit.deposit_value) || 0
  if (deposit.deposit_type === 'percent') return Math.round(total * (val / 100) * 100) / 100
  return val
}

export function calcTotals(subtotal: number, vatRate: number) {
  const vat_amount = Math.round(subtotal * (vatRate / 100) * 100) / 100
  const total = Math.round((subtotal + vat_amount) * 100) / 100
  return { vat_amount, total }
}

/** Escape a string for safe insertion into printable HTML. */
export function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

/** Print arbitrary HTML via a hidden iframe (works in Electron + the browser). */
export function printHtml(html: string): void {
  const iframe = document.createElement('iframe')
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
  document.body.appendChild(iframe)
  const doc = iframe.contentWindow?.document
  if (!doc) return
  doc.open()
  doc.write(html)
  doc.close()
  iframe.contentWindow?.focus()
  setTimeout(() => {
    iframe.contentWindow?.print()
    setTimeout(() => document.body.removeChild(iframe), 1500)
  }, 300)
}

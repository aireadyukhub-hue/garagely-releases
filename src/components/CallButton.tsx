import { Phone } from 'lucide-react'

/**
 * Small call button placed next to a phone number. Uses window.open('tel:…')
 * which the desktop app routes to the OS via shell.openExternal (so web diallers
 * like Aircall pick it up), and which works directly in the browser too.
 */
export default function CallButton({ number, className = '' }: { number?: string | null; className?: string }) {
  if (!number) return null
  const clean = number.replace(/[^+\d]/g, '')
  if (!clean) return null
  return (
    <button
      type="button"
      title={`Call ${number}`}
      onClick={(e) => { e.stopPropagation(); window.open(`tel:${clean}`) }}
      className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-green-400 hover:text-green-300 hover:bg-green-500/10 transition-colors shrink-0 ${className}`}
    >
      <Phone className="w-3.5 h-3.5" />
    </button>
  )
}

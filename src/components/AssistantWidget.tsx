import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Send, Loader2, X } from 'lucide-react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'

const MASCOT_NAME = 'Timmy'
const SUGGESTIONS = [
  'How do I add a technician?',
  'Where do I change the VAT rate?',
  'How do I book a job into the calendar?',
]

export const ROUTE_LABELS: Record<string, string> = {
  '/dashboard': 'Dashboard', '/calendar': 'Calendar', '/team': 'Team',
  '/customers': 'Customers', '/vehicles': 'Vehicles', '/quotes': 'Quotes',
  '/jobs': 'Job Sheets', '/invoices': 'Invoices', '/parts': 'Parts',
  '/suppliers': 'Suppliers', '/reports': 'Reports', '/settings': 'Settings', '/help': 'Help',
}

// Pull a "GOTO: /path" hint out of the assistant's reply (and strip it from the text).
export function parseGoto(text: string): { text: string; goto: string | null } {
  const m = text.match(/GOTO:\s*(\/[a-z-]+)/i)
  if (!m) return { text: text.trim(), goto: null }
  const goto = m[1].toLowerCase()
  return { text: text.replace(/GOTO:\s*\/[a-z-]+/i, '').trim(), goto: ROUTE_LABELS[goto] ? goto : null }
}

type Msg = { role: 'user' | 'assistant'; content: string; goto?: string | null }

/** Timmy — the 10mm socket mascot. Shows a "thinking" face on demand. */
export function Mascot({ className, expression = 'idle' }: { className?: string; expression?: 'idle' | 'thinking' }) {
  const thinking = expression === 'thinking'
  return (
    <svg viewBox="0 0 64 64" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* thought dots (thinking only) */}
      {thinking && (
        <g className="timmy-think">
          <circle cx="47" cy="12" r="1.5" fill="#F4A523" />
          <circle cx="52" cy="9" r="1.9" fill="#F4A523" />
          <circle cx="57" cy="5.5" r="2.3" fill="#F4A523" />
        </g>
      )}
      {/* legs + feet */}
      <rect x="24" y="50" width="4" height="10" rx="2" fill="#6b7280" />
      <rect x="36" y="50" width="4" height="10" rx="2" fill="#6b7280" />
      <ellipse cx="26" cy="61" rx="4.5" ry="2" fill="#3f4651" />
      <ellipse cx="38" cy="61" rx="4.5" ry="2" fill="#3f4651" />
      {/* waving left arm */}
      <path d="M18 32 Q10 30 9 22" stroke="#F4A523" strokeWidth="3.4" fill="none" strokeLinecap="round" />
      <circle cx="9" cy="21" r="3" fill="#F4A523" />
      {/* right arm */}
      <path d="M46 33 Q54 35 54 41" stroke="#F4A523" strokeWidth="3.4" fill="none" strokeLinecap="round" />
      <circle cx="54" cy="42" r="3" fill="#F4A523" />
      {/* square drive recess (top of socket) */}
      <rect x="27" y="8" width="10" height="7" rx="1.5" fill="#3a4150" stroke="#8b919c" strokeWidth="1.2" />
      {/* chrome socket body */}
      <rect x="18" y="14" width="28" height="38" rx="6" fill="#d7dbe2" stroke="#9aa0aa" strokeWidth="2" />
      {/* chrome facet highlights */}
      <rect x="21" y="16" width="4" height="34" rx="2" fill="#f0f2f5" opacity="0.75" />
      <rect x="39" y="16" width="3" height="34" rx="1.5" fill="#b4bac4" opacity="0.6" />
      {/* eyes */}
      <circle cx="27.5" cy="27" r="3.4" fill="#fff" />
      <circle cx="36.5" cy="27" r="3.4" fill="#fff" />
      <circle cx={thinking ? 27.6 : 28.2} cy={thinking ? 25.6 : 27.7} r="1.6" fill="#1f2430" />
      <circle cx={thinking ? 36.6 : 37.2} cy={thinking ? 25.6 : 27.7} r="1.6" fill="#1f2430" />
      {/* mouth: smile when idle, little "o" when thinking */}
      {thinking
        ? <circle cx="32" cy="35" r="1.9" fill="none" stroke="#1f2430" strokeWidth="1.8" />
        : <path d="M27.5 33 Q32 37 36.5 33" stroke="#1f2430" strokeWidth="2" fill="none" strokeLinecap="round" />}
      {/* "10" size marking */}
      <text x="32" y="48" textAnchor="middle" fontSize="7.5" fontWeight="700" fill="#5b6270" fontFamily="Arial, Helvetica, sans-serif">10</text>
    </svg>
  )
}

export default function AssistantWidget() {
  const [open, setOpen] = useState(false)
  const [chat, setChat] = useState<Msg[]>([])
  const [q, setQ] = useState('')
  const [asking, setAsking] = useState(false)
  const navigate = useNavigate()
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [chat, asking, open])

  const ask = async (text?: string) => {
    const question = (text ?? q).trim()
    if (!question || asking) return
    setQ('')
    const history = chat.map(m => ({ role: m.role, content: m.content })).slice(-6)
    setChat(c => [...c, { role: 'user', content: question }])
    setAsking(true)
    try {
      const answer = await api.askAssistant(question, history)
      const { text: clean, goto } = parseGoto(answer)
      setChat(c => [...c, { role: 'assistant', content: clean, goto }])
    } catch (e) {
      setChat(c => [...c, { role: 'assistant', content: (e as Error).message || 'Sorry, something went wrong — try again.' }])
    } finally {
      setAsking(false)
    }
  }

  const go = (path: string) => { setOpen(false); navigate(path) }

  return (
    <>
      <style>{`@keyframes timmy-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}.timmy-bob{animation:timmy-bob 2.6s ease-in-out infinite}@keyframes timmy-think{0%,100%{opacity:.35}50%{opacity:1}}.timmy-think{animation:timmy-think 1s ease-in-out infinite}`}</style>

      {open && (
        <div className="fixed bottom-24 right-5 z-[95] w-[360px] max-w-[calc(100vw-2.5rem)] bg-[#16181D] border border-zinc-800 rounded-2xl shadow-2xl flex flex-col" style={{ maxHeight: 'min(70vh, 560px)' }}>
          <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800 shrink-0">
            <Mascot className="w-8 h-8" expression={asking ? 'thinking' : 'idle'} />
            <div className="leading-tight">
              <div className="text-sm font-semibold text-white">{MASCOT_NAME}</div>
              <div className="text-[11px] text-zinc-500">The 10mm · your GarageLY helper</div>
            </div>
            <button onClick={() => setOpen(false)} className="ml-auto text-zinc-500 hover:text-white"><X className="w-4 h-4" /></button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {chat.length === 0 ? (
              <div className="text-sm text-zinc-400">
                Hi, I'm {MASCOT_NAME} — the 10mm that never gets lost 🔧 Ask me how to do anything in GarageLY.
                <div className="flex flex-wrap gap-2 mt-3">
                  {SUGGESTIONS.map(s => (
                    <button key={s} onClick={() => ask(s)} className="text-xs px-2.5 py-1.5 rounded-lg border border-zinc-700 text-zinc-300 hover:border-[#F4A523]/50 hover:text-white transition-colors">{s}</button>
                  ))}
                </div>
              </div>
            ) : chat.map((m, i) => (
              <div key={i} className={cn(m.role === 'user' ? 'text-right' : '')}>
                <div className={cn('inline-block rounded-xl px-3 py-2 max-w-[88%] text-sm whitespace-pre-wrap text-left',
                  m.role === 'user' ? 'bg-[#F4A523]/15 text-zinc-100' : 'bg-zinc-800/70 text-zinc-200')}>
                  {m.content}
                </div>
                {m.goto && (
                  <div>
                    <button onClick={() => go(m.goto!)} className="btn-primary text-xs py-1 px-2.5 mt-1.5">Take me to {ROUTE_LABELS[m.goto]} →</button>
                  </div>
                )}
              </div>
            ))}
            {asking && <div className="text-sm text-zinc-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> {MASCOT_NAME} is thinking…</div>}
            <div ref={endRef} />
          </div>

          <div className="p-3 border-t border-zinc-800 flex gap-2 shrink-0">
            <input className="input flex-1" value={q} onChange={e => setQ(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') ask() }} placeholder={`Ask ${MASCOT_NAME}…`} />
            <button onClick={() => ask()} disabled={asking || !q.trim()} className="btn-primary"><Send className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      {/* Floating mascot */}
      <button onClick={() => setOpen(o => !o)} title={`Ask ${MASCOT_NAME}`}
        className="fixed bottom-5 right-5 z-[95] rounded-full transition-transform hover:scale-105 focus:outline-none">
        <Mascot className="w-14 h-14 drop-shadow-xl timmy-bob" expression={asking ? 'thinking' : 'idle'} />
        {!open && <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#F4A523] border-2 border-[#16181D]" />}
      </button>
    </>
  )
}

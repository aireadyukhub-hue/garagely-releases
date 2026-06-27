import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Send, Loader2, X, Smile } from 'lucide-react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'

const MASCOT_NAME = 'Timmy'
const SUGGESTIONS = [
  'How do I add a technician?',
  'Where do I change the VAT rate?',
  'How do I book a job into the calendar?',
  'Tell me a joke 🔧',
]

// Timmy's little black book of garage gags. Kept client-side so he's always
// funny even if the AI backend is having a coffee break.
const JOKES = [
  "Why did the mechanic sleep under the car? He wanted to wake up oily. 🔧",
  "I told my mate his exhaust was hanging off. He just let it slide.",
  "Why don't engines ever get invited to parties? They're always a bit too revved up.",
  "What do you call a tuned MQB with no intercooler? An optimist.",
  "I'm a 10mm socket — statistically, I'm the friend you'll lose first. Cherish me. 😢",
  "Why did the spark plug get promoted? It really fired things up.",
  "My therapist says I have attachment issues. I said mate, I'm a socket, that's the whole job.",
  "What's a downpipe's favourite music? Anything with good flow.",
  "Why did the gearbox break up with the clutch? It felt taken for granted.",
  "Tuning a diesel is easy — you just have to make sure it doesn't get the wrong impression and start rolling coal.",
  "Why was the battery so calm? It had plenty of charge left to give.",
  "A turbo walked into a bar. Took a while to get going, then it absolutely sent it.",
  "What do you call an intercooler that tells jokes? A real chill guy.",
  "Why did the brake disc go to school? To get a little more... rotor-tion.",
  "My favourite exercise? A good torque-out. 💪",
]

const randomJoke = () => JOKES[Math.floor(Math.random() * JOKES.length)]
const GREETINGS = [
  `Hi, I'm ${MASCOT_NAME} — the 10mm that never gets lost 🔧 Ask me how to do anything in GarageLY (or ask for a joke, I've got loads).`,
  `Alright? ${MASCOT_NAME} here, your favourite 10mm socket. Ask me anything about GarageLY — or fancy a quick car joke?`,
  `${MASCOT_NAME} reporting for duty 🔧 Need a hand with GarageLY? Or shall I torque you through a joke first?`,
]

export const ROUTE_LABELS: Record<string, string> = {
  '/dashboard': 'Dashboard', '/calendar': 'Calendar', '/team': 'Team',
  '/customers': 'Customers', '/vehicles': 'Vehicles', '/quotes': 'Quotes',
  '/preset-jobs': 'Preset Jobs',
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

/**
 * Timmy — the 10mm socket mascot.
 * Body is a chrome socket: chamfered hex drive on top, fluted/knurled barrel,
 * chrome highlights and a "10" size stamp. Keeps his face, waving arms and feet.
 */
export function Mascot({ className, expression = 'idle' }: { className?: string; expression?: 'idle' | 'thinking' }) {
  const thinking = expression === 'thinking'
  return (
    <svg viewBox="0 0 64 70" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        {/* chrome barrel gradient */}
        <linearGradient id="timmyChrome" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#aab0bb" />
          <stop offset="18%" stopColor="#eef1f5" />
          <stop offset="42%" stopColor="#cfd4dc" />
          <stop offset="60%" stopColor="#e7eaef" />
          <stop offset="82%" stopColor="#b3b9c4" />
          <stop offset="100%" stopColor="#959ba6" />
        </linearGradient>
        <linearGradient id="timmyDrive" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3a4150" />
          <stop offset="100%" stopColor="#262b35" />
        </linearGradient>
      </defs>

      {/* thought dots (thinking only) */}
      {thinking && (
        <g className="timmy-think">
          <circle cx="49" cy="12" r="1.5" fill="#F4A523" />
          <circle cx="54" cy="9" r="1.9" fill="#F4A523" />
          <circle cx="59" cy="5.5" r="2.3" fill="#F4A523" />
        </g>
      )}

      {/* legs + feet */}
      <rect x="24" y="56" width="4" height="11" rx="2" fill="#6b7280" />
      <rect x="36" y="56" width="4" height="11" rx="2" fill="#6b7280" />
      <ellipse cx="26" cy="67.5" rx="4.8" ry="2.1" fill="#3f4651" />
      <ellipse cx="38" cy="67.5" rx="4.8" ry="2.1" fill="#3f4651" />

      {/* waving left arm */}
      <path d="M16 36 Q8 34 7 25" stroke="#F4A523" strokeWidth="3.4" fill="none" strokeLinecap="round" />
      <circle cx="7" cy="24" r="3" fill="#F4A523" />
      {/* right arm */}
      <path d="M48 37 Q56 39 56 45" stroke="#F4A523" strokeWidth="3.4" fill="none" strokeLinecap="round" />
      <circle cx="56" cy="46" r="3" fill="#F4A523" />

      {/* ── socket body ───────────────────────────────────────────── */}
      {/* chamfered hex drive end on top (the recognisable socket opening) */}
      <polygon points="32,5 41,10 41,18 32,23 23,18 23,10" fill="url(#timmyDrive)" stroke="#8b919c" strokeWidth="1.3" strokeLinejoin="round" />
      {/* inner square drive recess */}
      <rect x="28" y="10.5" width="8" height="7" rx="1.2" fill="#1b1f27" />
      <rect x="29" y="11.3" width="2" height="5.4" rx="1" fill="#454c59" />

      {/* chrome barrel */}
      <rect x="16" y="17" width="32" height="40" rx="7" fill="url(#timmyChrome)" stroke="#878d98" strokeWidth="2" />
      {/* fluted/knurled vertical grooves to read as a machined socket */}
      <g stroke="#9aa0ab" strokeWidth="1" opacity="0.5">
        <line x1="23" y1="22" x2="23" y2="52" />
        <line x1="41" y1="22" x2="41" y2="52" />
      </g>
      {/* bright + shadow facet highlights */}
      <rect x="19.5" y="20" width="3.6" height="34" rx="1.8" fill="#fbfcfe" opacity="0.8" />
      <rect x="43" y="20" width="2.6" height="34" rx="1.3" fill="#9097a2" opacity="0.55" />
      {/* knurl band near the base */}
      <g stroke="#8b919c" strokeWidth="0.8" opacity="0.45">
        <line x1="18" y1="50" x2="46" y2="50" />
        <line x1="18" y1="53" x2="46" y2="53" />
      </g>

      {/* ── face ──────────────────────────────────────────────────── */}
      <circle cx="27.5" cy="32" r="3.5" fill="#fff" />
      <circle cx="36.5" cy="32" r="3.5" fill="#fff" />
      <circle cx={thinking ? 27.6 : 28.2} cy={thinking ? 30.6 : 32.7} r="1.6" fill="#1f2430" />
      <circle cx={thinking ? 36.6 : 37.2} cy={thinking ? 30.6 : 32.7} r="1.6" fill="#1f2430" />
      {/* mouth: cheeky grin when idle, little "o" when thinking */}
      {thinking
        ? <circle cx="32" cy="40" r="1.9" fill="none" stroke="#1f2430" strokeWidth="1.8" />
        : <path d="M27 38 Q32 43 37 38" stroke="#1f2430" strokeWidth="2" fill="none" strokeLinecap="round" />}
      {/* rosy cheeks */}
      <circle cx="24" cy="37.5" r="1.6" fill="#F4A523" opacity="0.35" />
      <circle cx="40" cy="37.5" r="1.6" fill="#F4A523" opacity="0.35" />

      {/* "10" size marking */}
      <text x="32" y="51.5" textAnchor="middle" fontSize="8" fontWeight="800" fill="#5b6270" fontFamily="Arial, Helvetica, sans-serif">10</text>
    </svg>
  )
}

export default function AssistantWidget() {
  const [open, setOpen] = useState(false)
  const [chat, setChat] = useState<Msg[]>([])
  const [q, setQ] = useState('')
  const [asking, setAsking] = useState(false)
  const [greeting] = useState(() => GREETINGS[Math.floor(Math.random() * GREETINGS.length)])
  const navigate = useNavigate()
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [chat, asking, open])

  // Local joke replies feel instant and work with no backend round-trip.
  const wantsJoke = (s: string) => /\b(joke|funny|make me laugh|cheer me up|pun)\b/i.test(s)

  const ask = async (text?: string) => {
    const question = (text ?? q).trim()
    if (!question || asking) return
    setQ('')
    setChat(c => [...c, { role: 'user', content: question }])

    if (wantsJoke(question)) {
      // Crack a joke locally — no API needed.
      setChat(c => [...c, { role: 'assistant', content: randomJoke() }])
      return
    }

    const history = chat.map(m => ({ role: m.role, content: m.content })).slice(-6)
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

  const tellJoke = () => setChat(c => [...c, { role: 'assistant', content: randomJoke() }])

  const go = (path: string) => { setOpen(false); navigate(path) }

  return (
    <>
      <style>{`@keyframes timmy-bob{0%,100%{transform:translateY(0) rotate(-2deg)}50%{transform:translateY(-4px) rotate(2deg)}}.timmy-bob{animation:timmy-bob 2.8s ease-in-out infinite}@keyframes timmy-think{0%,100%{opacity:.35}50%{opacity:1}}.timmy-think{animation:timmy-think 1s ease-in-out infinite}`}</style>

      {open && (
        <div className="fixed bottom-24 right-5 z-[95] w-[360px] max-w-[calc(100vw-2.5rem)] bg-[#16181D] border border-zinc-800 rounded-2xl shadow-2xl flex flex-col" style={{ maxHeight: 'min(70vh, 560px)' }}>
          <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800 shrink-0">
            <Mascot className="w-9 h-9" expression={asking ? 'thinking' : 'idle'} />
            <div className="leading-tight">
              <div className="text-sm font-semibold text-white">{MASCOT_NAME}</div>
              <div className="text-[11px] text-zinc-500">The 10mm · your GarageLY helper</div>
            </div>
            <button onClick={() => { tellJoke() }} title="Tell me a joke"
              className="ml-auto text-zinc-500 hover:text-[#F4A523] transition-colors"><Smile className="w-4 h-4" /></button>
            <button onClick={() => setOpen(false)} className="text-zinc-500 hover:text-white"><X className="w-4 h-4" /></button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {chat.length === 0 ? (
              <div className="text-sm text-zinc-400">
                {greeting}
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
        <Mascot className="w-16 h-16 drop-shadow-xl timmy-bob" expression={asking ? 'thinking' : 'idle'} />
        {!open && <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#F4A523] border-2 border-[#16181D]" />}
      </button>
    </>
  )
}

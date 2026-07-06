import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Send, CheckCircle, Sparkles, Loader2 } from 'lucide-react'
import api from '@/lib/api'
import { formatDateTime, cn } from '@/lib/utils'
import { parseGoto, ROUTE_LABELS } from '@/components/AssistantWidget'

interface Submission { id: number; type: string; subject?: string; message: string; status: string; created_at: string }
type ChatMsg = { role: 'user' | 'assistant'; content: string; goto?: string | null }
const SUGGESTIONS = [
  'How do I add a technician?',
  'Where do I change the VAT rate?',
  'How do I book a job into the calendar?',
  'How do I add my logo?',
]

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  open: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  closed: 'bg-green-500/20 text-green-400 border-green-500/30',
}

export default function Help() {
  const [type, setType] = useState<'feedback' | 'support'>('feedback')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [items, setItems] = useState<Submission[]>([])

  const [chat, setChat] = useState<ChatMsg[]>([])
  const [q, setQ] = useState('')
  const [asking, setAsking] = useState(false)
  const chatEnd = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  const load = () => api.getSubmissions().then(d => setItems(d as Submission[])).catch(() => {})
  useEffect(() => { load() }, [])
  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: 'smooth' }) }, [chat, asking])

  const ask = async (text?: string) => {
    const question = (text ?? q).trim()
    if (!question || asking) return
    setQ('')
    const history = chat.slice(-6)
    setChat(c => [...c, { role: 'user', content: question }])
    setAsking(true)
    try {
      const answer = await api.askAssistant(question, history)
      const { text, goto } = parseGoto(answer)
      setChat(c => [...c, { role: 'assistant', content: text, goto }])
    } catch (e) {
      setChat(c => [...c, { role: 'assistant', content: (e as Error).message || 'Sorry, something went wrong. Try again.' }])
    } finally {
      setAsking(false)
    }
  }

  const submit = async () => {
    if (!message.trim()) return
    setSending(true)
    await api.createSubmission({ type, subject: subject.trim() || null, message: message.trim() })
    setSending(false); setSent(true); setSubject(''); setMessage('')
    await load()
    setTimeout(() => setSent(false), 3500)
  }

  return (
    <div className="pt-2 max-w-3xl">
      <div className="page-header"><h1 className="page-title">Help & Feedback</h1></div>

      {/* AI assistant */}
      <div className="card mb-5">
        <div className="card-header flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#F4A523]" />
          <span className="text-sm font-medium text-zinc-300">Ask the assistant</span>
          <span className="text-xs text-zinc-600 ml-auto">Answers how-to questions about GarageDash</span>
        </div>
        <div className="card-body space-y-3">
          {chat.length === 0 ? (
            <div className="text-sm text-zinc-500">
              Ask me anything about using GarageDash — where a setting is, or how to do something.
              <div className="flex flex-wrap gap-2 mt-3">
                {SUGGESTIONS.map(s => (
                  <button key={s} onClick={() => ask(s)} className="text-xs px-2.5 py-1.5 rounded-lg border border-zinc-700 text-zinc-300 hover:border-[#F4A523]/50 hover:text-white transition-colors">{s}</button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {chat.map((m, i) => (
                <div key={i} className={cn(m.role === 'user' ? 'text-right' : '')}>
                  <div className={cn('inline-block rounded-xl px-3 py-2 max-w-[85%] text-sm whitespace-pre-wrap text-left',
                    m.role === 'user' ? 'bg-[#F4A523]/15 text-zinc-100' : 'bg-zinc-800/70 text-zinc-200')}>
                    {m.content}
                  </div>
                  {m.goto && (
                    <div><button onClick={() => navigate(m.goto!)} className="btn-primary text-xs py-1 px-2.5 mt-1.5">Take me to {ROUTE_LABELS[m.goto]} →</button></div>
                  )}
                </div>
              ))}
              {asking && <div className="text-sm text-zinc-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Thinking…</div>}
              <div ref={chatEnd} />
            </div>
          )}
          <div className="flex gap-2">
            <input className="input flex-1" value={q} onChange={e => setQ(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') ask() }} placeholder="e.g. How do I add a technician?" />
            <button onClick={() => ask()} disabled={asking || !q.trim()} className="btn-primary"><Send className="w-4 h-4" /></button>
          </div>
        </div>
      </div>

      <div className="card mb-5">
        <div className="card-body space-y-4">
          <div className="flex bg-zinc-800/60 rounded-lg p-0.5 w-fit">
            {([['feedback', 'Feedback / idea'], ['support', 'Get help']] as const).map(([v, lbl]) => (
              <button key={v} onClick={() => setType(v)}
                className={cn('px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
                  type === v ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-200')}>
                {lbl}
              </button>
            ))}
          </div>
          <p className="text-sm text-zinc-500">
            {type === 'feedback'
              ? 'Got an idea or a feature request? Send it straight to the GarageDash team.'
              : 'Stuck on something? Send us a message and we\'ll get back to you.'}
          </p>
          <div><label className="label">Subject</label><input className="input" value={subject} onChange={e => setSubject(e.target.value)} placeholder={type === 'feedback' ? 'e.g. Add a parts barcode scanner' : 'e.g. Can\'t print an invoice'} /></div>
          <div><label className="label">Message *</label><textarea className="textarea" rows={5} value={message} onChange={e => setMessage(e.target.value)} placeholder="Tell us what's on your mind…" /></div>
          <div className="flex items-center gap-3">
            <button onClick={submit} disabled={sending || !message.trim()} className="btn-primary">
              {sent ? <><CheckCircle className="w-4 h-4" /> Sent!</> : <><Send className="w-4 h-4" /> {sending ? 'Sending…' : 'Send'}</>}
            </button>
            {sent && <span className="text-sm text-green-400">Thanks — we've got it.</span>}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><span className="text-sm font-medium text-zinc-300">Your submissions</span></div>
        <div>
          {items.length === 0 ? (
            <div className="px-5 py-8 text-center text-zinc-500 text-sm">Nothing sent yet</div>
          ) : items.map(s => (
            <div key={s.id} className="px-5 py-3.5 border-b border-zinc-800/50 last:border-0">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs uppercase tracking-wide text-zinc-500">{s.type === 'support' ? 'Support' : 'Feedback'}</span>
                    <span className="text-sm font-medium text-zinc-200 truncate">{s.subject || '(no subject)'}</span>
                  </div>
                  <p className="text-sm text-zinc-400 truncate mt-0.5">{s.message}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={cn('status-badge', STATUS_COLORS[s.status] || STATUS_COLORS.new)}>{s.status}</span>
                  <span className="text-xs text-zinc-600">{formatDateTime(s.created_at)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

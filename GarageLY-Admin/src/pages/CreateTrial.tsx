import { useState, FormEvent } from 'react'
import { api } from '../lib/api'
import { Loader2, CheckCircle2, AlertCircle, Copy, Mail } from 'lucide-react'

const WEB_URL = 'https://garagely-app.pages.dev'
const WIN_URL = 'https://github.com/aireadyukhub-hue/garagely-releases/releases/latest/download/GarageLY-Setup.exe'

type Result = { key: string; trialEndsAt: string; email: string; garageName: string; trialDays: number }

function buildInvite(r: Result): string {
  const expiry = new Date(r.trialEndsAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  return `Hi,

You're invited to try GarageLY free for ${r.trialDays} days — no card needed.

1. Open GarageLY:
   • In your browser: ${WEB_URL}
   • Or on Windows: ${WIN_URL}
2. Choose "Activate with a licence key" and create a password.
3. Enter this licence key:

   ${r.key}

Your trial runs until ${expiry}. When it ends you'll get a prompt in the app to set up payment if you'd like to keep going.

Any problems, just give me a shout.`
}

export default function CreateTrial() {
  const [email, setEmail] = useState('')
  const [garageName, setGarageName] = useState('')
  const [trialDays, setTrialDays] = useState(14)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [copied, setCopied] = useState<'key' | 'invite' | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const r = await api.createTrial(email, garageName, trialDays)
      setResult({ key: r.licence.key, trialEndsAt: r.licence.trial_ends_at, email, garageName, trialDays })
      setEmail('')
      setGarageName('')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function copy(text: string, which: 'key' | 'invite') {
    navigator.clipboard.writeText(text)
    setCopied(which)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-1">Invite a tester</h1>
      <p className="text-[#9CA3AF] text-sm mb-6">Creates a free trial licence (no card needed) and a ready-to-send invite.</p>

      <div className="max-w-md">
        <div className="bg-[#1F2128] border border-[#2A2D35] rounded-2xl p-6">
          {result ? (
            <div className="py-2">
              <div className="text-center">
                <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-3" />
                <p className="text-white font-semibold mb-1">Trial invite ready!</p>
                <p className="text-[#9CA3AF] text-sm mb-4">{result.trialDays}-day trial for {result.email}</p>
              </div>

              <label className="block text-xs text-[#9CA3AF] mb-1.5">Licence key</label>
              <div className="flex items-center gap-2 bg-[#16181D] border border-[#2A2D35] rounded-xl px-4 py-3 mb-4">
                <code className="text-[#F4A523] font-mono text-sm flex-1">{result.key}</code>
                <button onClick={() => copy(result.key, 'key')} className="text-[#9CA3AF] hover:text-white">
                  {copied === 'key' ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>

              <label className="block text-xs text-[#9CA3AF] mb-1.5">Invite message</label>
              <textarea
                readOnly
                value={buildInvite(result)}
                className="w-full h-44 bg-[#16181D] border border-[#2A2D35] rounded-xl px-3 py-2.5 text-[#D1D5DB] text-xs font-mono resize-none focus:outline-none mb-3"
                onFocus={(e) => e.currentTarget.select()}
              />

              <div className="flex gap-2">
                <button
                  onClick={() => copy(buildInvite(result), 'invite')}
                  className="flex-1 bg-[#2A2D35] hover:bg-[#353841] text-white rounded-xl px-4 py-2.5 text-sm flex items-center justify-center gap-2"
                >
                  {copied === 'invite' ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                  Copy invite
                </button>
                <a
                  href={`mailto:${encodeURIComponent(result.email)}?subject=${encodeURIComponent('Your GarageLY trial invite')}&body=${encodeURIComponent(buildInvite(result))}`}
                  className="flex-1 bg-[#F4A523] hover:bg-[#E09415] text-[#16181D] font-semibold rounded-xl px-4 py-2.5 text-sm flex items-center justify-center gap-2"
                >
                  <Mail className="w-4 h-4" /> Compose email
                </a>
              </div>

              <p className="text-[#6B7280] text-xs mt-3 text-center">
                Trial expires {new Date(result.trialEndsAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
              <button onClick={() => setResult(null)} className="mt-4 w-full text-[#F4A523] text-sm hover:underline">
                Invite someone else
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#D1D5DB] mb-1.5">Their email address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="liam@example.com"
                  className="w-full bg-[#16181D] border border-[#2A2D35] rounded-xl px-4 py-3 text-white placeholder-[#4B5563] focus:outline-none focus:border-[#F4A523] text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#D1D5DB] mb-1.5">Garage / business name</label>
                <input
                  type="text"
                  required
                  value={garageName}
                  onChange={(e) => setGarageName(e.target.value)}
                  placeholder="Liam's Garage"
                  className="w-full bg-[#16181D] border border-[#2A2D35] rounded-xl px-4 py-3 text-white placeholder-[#4B5563] focus:outline-none focus:border-[#F4A523] text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#D1D5DB] mb-1.5">
                  Trial length: <span className="text-[#F4A523]">{trialDays} days</span>
                </label>
                <input
                  type="range"
                  min={7}
                  max={90}
                  value={trialDays}
                  onChange={(e) => setTrialDays(Number(e.target.value))}
                  className="w-full accent-[#F4A523]"
                />
                <div className="flex justify-between text-xs text-[#6B7280] mt-1">
                  <span>7 days</span>
                  <span>90 days</span>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                  <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#F4A523] hover:bg-[#E09415] disabled:opacity-40 text-[#16181D] font-semibold rounded-xl px-4 py-3 transition-colors flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : `Invite to try GarageLY for ${trialDays} days`}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

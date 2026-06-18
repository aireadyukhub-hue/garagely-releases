import { useState, FormEvent } from 'react'
import { api } from '../lib/api'
import { Loader2, CheckCircle2, AlertCircle, Copy } from 'lucide-react'

export default function CreateTrial() {
  const [email, setEmail] = useState('')
  const [garageName, setGarageName] = useState('')
  const [trialDays, setTrialDays] = useState(14)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ key: string; trialEndsAt: string } | null>(null)
  const [copied, setCopied] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const r = await api.createTrial(email, garageName, trialDays)
      setResult({ key: r.licence.key, trialEndsAt: r.licence.trial_ends_at })
      setEmail('')
      setGarageName('')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function copyKey() {
    if (!result) return
    navigator.clipboard.writeText(result.key)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Create Free Trial</h1>

      <div className="max-w-md">
        <div className="bg-[#1F2128] border border-[#2A2D35] rounded-2xl p-6">
          {result ? (
            <div className="text-center py-4">
              <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-3" />
              <p className="text-white font-semibold mb-1">Trial licence created!</p>
              <p className="text-[#9CA3AF] text-sm mb-4">Send this key to the garage owner:</p>
              <div className="flex items-center gap-2 bg-[#16181D] border border-[#2A2D35] rounded-xl px-4 py-3">
                <code className="text-[#F4A523] font-mono text-sm flex-1">{result.key}</code>
                <button onClick={copyKey} className="text-[#9CA3AF] hover:text-white">
                  {copied ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[#6B7280] text-xs mt-3">
                Trial expires: {new Date(result.trialEndsAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
              <button
                onClick={() => setResult(null)}
                className="mt-5 text-[#F4A523] text-sm hover:underline"
              >
                Create another
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#D1D5DB] mb-1.5">Email address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="owner@bobsgarage.co.uk"
                  className="w-full bg-[#16181D] border border-[#2A2D35] rounded-xl px-4 py-3 text-white placeholder-[#4B5563] focus:outline-none focus:border-[#F4A523] text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#D1D5DB] mb-1.5">Garage name</label>
                <input
                  type="text"
                  required
                  value={garageName}
                  onChange={(e) => setGarageName(e.target.value)}
                  placeholder="Bob's Autos"
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
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Generate Trial Licence'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

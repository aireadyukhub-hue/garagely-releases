import { useState, FormEvent } from 'react'
import { KeyRound, Loader2, AlertCircle, Mail, Lock } from 'lucide-react'
import { signIn, activateAccount } from '../lib/auth'

type Mode = 'signin' | 'activate'

function formatKey(raw: string) {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
  const parts: string[] = []
  if (clean.startsWith('GRLY')) {
    parts.push('GRLY')
    const rest = clean.slice(4)
    for (let i = 0; i < 3; i++) {
      if (rest.slice(i * 4, i * 4 + 4)) parts.push(rest.slice(i * 4, i * 4 + 4))
    }
  } else {
    for (let i = 0; i < 4; i++) {
      if (clean.slice(i * 4, i * 4 + 4)) parts.push(clean.slice(i * 4, i * 4 + 4))
    }
  }
  return parts.join('-')
}

const inputClass =
  'w-full bg-[#16181D] border border-[#2A2D35] rounded-xl px-4 py-3 text-white text-sm placeholder-[#4B5563] focus:outline-none focus:border-[#F4A523] transition-colors'

export default function Auth() {
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [garageName, setGarageName] = useState('')
  const [key, setKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (mode === 'signin') {
        await signIn(email, password)
      } else {
        await activateAccount({ key, email, password, garageName })
      }
      // On success, the auth state listener in App swaps to the app.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  const canSubmit =
    mode === 'signin'
      ? email.length > 3 && password.length >= 6
      : email.length > 3 && password.length >= 6 && key.length === 19

  return (
    <div className="min-h-screen bg-[#16181D] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#F4A523] mb-4">
            <KeyRound className="w-8 h-8 text-[#16181D]" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">GarageLY</h1>
          <p className="text-[#9CA3AF] mt-1 text-sm">Professional Garage Management</p>
        </div>

        <div className="bg-[#1F2128] rounded-2xl p-8 border border-[#2A2D35]">
          {/* Mode toggle */}
          <div className="flex bg-[#16181D] rounded-xl p-1 mb-6">
            <button
              type="button"
              onClick={() => { setMode('signin'); setError(null) }}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                mode === 'signin' ? 'bg-[#2A2D35] text-white' : 'text-[#9CA3AF] hover:text-white'
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => { setMode('activate'); setError(null) }}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                mode === 'activate' ? 'bg-[#2A2D35] text-white' : 'text-[#9CA3AF] hover:text-white'
              }`}
            >
              Activate licence
            </button>
          </div>

          <h2 className="text-xl font-semibold text-white mb-1">
            {mode === 'signin' ? 'Welcome back' : 'Set up your account'}
          </h2>
          <p className="text-[#9CA3AF] text-sm mb-6">
            {mode === 'signin'
              ? 'Sign in to access your garage on any device.'
              : 'Enter your licence key and choose a password. Your account works on desktop and the web.'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'activate' && (
              <div>
                <label className="block text-sm font-medium text-[#D1D5DB] mb-1.5">Licence key</label>
                <input
                  type="text"
                  value={key}
                  onChange={(e) => setKey(formatKey(e.target.value))}
                  placeholder="GRLY-XXXX-XXXX-XXXX"
                  maxLength={19}
                  spellCheck={false}
                  className={inputClass + ' font-mono'}
                  disabled={loading}
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-[#D1D5DB] mb-1.5">Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#6B7280] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@garage.co.uk"
                  autoComplete="email"
                  className={inputClass + ' pl-10'}
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#D1D5DB] mb-1.5">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#6B7280] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'activate' ? 'Choose a password (min 6 chars)' : 'Your password'}
                  autoComplete={mode === 'activate' ? 'new-password' : 'current-password'}
                  className={inputClass + ' pl-10'}
                  disabled={loading}
                />
              </div>
            </div>

            {mode === 'activate' && (
              <div>
                <label className="block text-sm font-medium text-[#D1D5DB] mb-1.5">
                  Garage name <span className="text-[#6B7280]">(optional)</span>
                </label>
                <input
                  type="text"
                  value={garageName}
                  onChange={(e) => setGarageName(e.target.value)}
                  placeholder="e.g. Apex Auto Services"
                  className={inputClass}
                  disabled={loading}
                />
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !canSubmit}
              className="w-full bg-[#F4A523] hover:bg-[#E09415] disabled:opacity-40 disabled:cursor-not-allowed text-[#16181D] font-semibold rounded-xl px-4 py-3 transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {mode === 'signin' ? 'Signing in…' : 'Activating…'}
                </>
              ) : mode === 'signin' ? (
                'Sign in'
              ) : (
                'Activate & create account'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-[#6B7280] text-xs mt-6">
          {mode === 'signin' ? "Don't have a licence? " : 'Need help? '}
          <span
            className="text-[#9CA3AF] cursor-pointer hover:text-[#F4A523]"
            onClick={() =>
              window.open(
                mode === 'signin' ? 'https://garagely.pages.dev' : 'mailto:support@garagely.co.uk',
                '_blank',
              )
            }
          >
            {mode === 'signin' ? 'Get a free trial' : 'support@garagely.co.uk'}
          </span>
        </p>
      </div>
    </div>
  )
}

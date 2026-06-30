import { useState, FormEvent } from 'react'
import { KeyRound, Loader2, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react'

interface Props {
  onActivated: () => void
}

export default function Activate({ onActivated }: Props) {
  const [key, setKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  function formatKey(raw: string) {
    // Auto-format as user types: GRLY-XXXX-XXXX-XXXX
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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const result = await window.api.activateLicence(key)
      if (result.success) {
        setSuccess(true)
        setTimeout(() => onActivated(), 1200)
      } else {
        setError(result.error || 'Activation failed. Please try again.')
      }
    } catch {
      setError('Unexpected error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#16181D] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Logo / Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#F4A523] mb-4">
            <KeyRound className="w-8 h-8 text-[#16181D]" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">GarageLY</h1>
          <p className="text-[#9CA3AF] mt-1 text-sm">Professional Garage Management</p>
        </div>

        <div className="bg-[#1F2128] rounded-2xl p-8 border border-[#2A2D35]">
          <h2 className="text-xl font-semibold text-white mb-1">Activate Your Licence</h2>
          <p className="text-[#9CA3AF] text-sm mb-6">
            Enter your licence key to unlock GarageLY. Don't have one?{' '}
            <a
              href="https://getgaragely.com"
              className="text-[#F4A523] hover:underline cursor-pointer"
              onClick={(e) => {
                e.preventDefault()
                // Opens in default browser via shell.openExternal (handled by main.ts)
                window.open('https://getgaragely.com', '_blank')
              }}
            >
              Get a free trial
            </a>
          </p>

          {success ? (
            <div className="flex flex-col items-center py-6 gap-3">
              <CheckCircle2 className="w-12 h-12 text-green-400" />
              <p className="text-white font-medium">Licence activated! Starting…</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#D1D5DB] mb-1.5">
                  Licence Key
                </label>
                <input
                  type="text"
                  value={key}
                  onChange={(e) => setKey(formatKey(e.target.value))}
                  placeholder="GRLY-XXXX-XXXX-XXXX"
                  maxLength={19}
                  spellCheck={false}
                  className="w-full bg-[#16181D] border border-[#2A2D35] rounded-xl px-4 py-3 text-white font-mono text-sm placeholder-[#4B5563] focus:outline-none focus:border-[#F4A523] transition-colors"
                  disabled={loading}
                />
              </div>

              {error && (
                <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                  <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || key.length < 19}
                className="w-full bg-[#F4A523] hover:bg-[#E09415] disabled:opacity-40 disabled:cursor-not-allowed text-[#16181D] font-semibold rounded-xl px-4 py-3 transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Activating…
                  </>
                ) : (
                  'Activate GarageLY'
                )}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-[#6B7280] text-xs mt-6">
          Need help?{' '}
          <span
            className="text-[#9CA3AF] cursor-pointer hover:text-[#F4A523]"
            onClick={() => window.open('mailto:info@getgaragely.com', '_blank')}
          >
            info@getgaragely.com
          </span>
        </p>
      </div>
    </div>
  )
}

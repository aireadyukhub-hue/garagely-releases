import { useState, FormEvent } from 'react'
import { KeyRound, Loader2, AlertCircle } from 'lucide-react'

interface Props {
  onLogin: () => void
}

export default function Login({ onLogin }: Props) {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      // Try a real API call to verify the password
      const BACKEND = import.meta.env.VITE_BACKEND_URL || 'https://garagely-backend.garagely.workers.dev'
      const res = await fetch(`${BACKEND}/.netlify/functions/admin-api?action=stats`, {
        headers: { 'X-Admin-Secret': password },
      })

      if (res.status === 401) {
        setError('Incorrect admin password')
        return
      }

      localStorage.setItem('admin_secret', password)
      onLogin()
    } catch {
      setError('Cannot reach server. Check your internet connection.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#16181D] flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#F4A523] mb-4">
            <KeyRound className="w-7 h-7 text-[#16181D]" />
          </div>
          <h1 className="text-2xl font-bold text-white">GarageDash Admin</h1>
          <p className="text-[#9CA3AF] text-sm mt-1">Enter your admin password to continue</p>
        </div>

        <div className="bg-[#1F2128] rounded-2xl p-6 border border-[#2A2D35]">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#D1D5DB] mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Admin password"
                className="w-full bg-[#16181D] border border-[#2A2D35] rounded-xl px-4 py-3 text-white placeholder-[#4B5563] focus:outline-none focus:border-[#F4A523] transition-colors"
                disabled={loading}
              />
            </div>

            {error && (
              <div className="flex items-center gap-2.5 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full bg-[#F4A523] hover:bg-[#E09415] disabled:opacity-40 disabled:cursor-not-allowed text-[#16181D] font-semibold rounded-xl px-4 py-3 transition-colors flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

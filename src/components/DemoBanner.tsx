import { useEffect, useState } from 'react'
import { Sparkles, Loader2, X } from 'lucide-react'
import api from '../lib/api'

// Shown while the garage is in demo mode. Offers a guided start and a clear
// "start fresh" action that wipes the seeded demo data.
export default function DemoBanner() {
  const [demo, setDemo] = useState(false)
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    api.isDemo().then(setDemo).catch(() => setDemo(false))
  }, [])

  if (!demo) return null

  async function clearDemo() {
    setBusy(true)
    try {
      await api.endDemoMode()
      // Reload so every page refetches the now-empty (real) data.
      window.location.reload()
    } catch {
      setBusy(false)
      setConfirming(false)
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-[#F4A523]/30 bg-[#F4A523]/10 px-4 py-3">
      <div className="flex items-start gap-3">
        <Sparkles className="w-5 h-5 text-[#F4A523] mt-0.5 shrink-0" />
        <div className="flex-1">
          <p className="text-white text-sm font-semibold">You're exploring demo data</p>
          <p className="text-[#D1D5DB] text-sm mt-0.5">
            These customers, jobs and invoices are samples so you can try things out.
            When you're ready, set your business details in <span className="text-[#F4A523]">Settings</span>,
            then clear the demo data to start adding your own.
          </p>

          {!confirming ? (
            <button
              onClick={() => setConfirming(true)}
              className="mt-3 inline-flex items-center gap-2 bg-[#F4A523] hover:bg-[#E09415] text-[#16181D] text-sm font-semibold rounded-lg px-3.5 py-2 transition-colors"
            >
              Clear demo data & start fresh
            </button>
          ) : (
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={clearDemo}
                disabled={busy}
                className="inline-flex items-center gap-2 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg px-3.5 py-2 transition-colors"
              >
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                Yes, delete all demo data
              </button>
              <button
                onClick={() => setConfirming(false)}
                disabled={busy}
                className="text-[#9CA3AF] hover:text-white text-sm px-2 py-2"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
        {!confirming && (
          <button
            onClick={() => setDemo(false)}
            title="Hide for now"
            className="text-[#9CA3AF] hover:text-white shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}

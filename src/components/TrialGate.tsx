import { useEffect, useState } from 'react'
import { Clock, Lock, X, Loader2, CreditCard } from 'lucide-react'
import api from '@/lib/api'
import { signOut } from '@/lib/auth'

type Status = {
  status: 'trial' | 'active' | 'expired' | 'cancelled' | 'unknown'
  trialEndsAt: string | null
  trialDaysLeft: number | null
  daysSinceEnd: number
}

const GRACE_DAYS = 3 // dismissible window after a trial ends, before the hard lock

export default function TrialGate() {
  const [s, setS] = useState<Status | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [checkingOut, setCheckingOut] = useState(false)

  useEffect(() => {
    api.getLicenceStatus().then(d => setS(d as Status)).catch(() => {})
  }, [])

  const subscribe = async () => {
    setCheckingOut(true)
    try {
      const url = await api.startCheckout()
      window.open(url, '_blank')
    } catch (e) {
      alert((e as Error).message || 'Could not open checkout — please try again.')
    } finally {
      setCheckingOut(false)
    }
  }

  if (!s) return null

  // Work out which UI to show.
  let mode: 'none' | 'countdown' | 'grace' | 'locked' = 'none'
  if (s.status === 'active' || s.status === 'unknown') mode = 'none'
  else if (s.status === 'cancelled') mode = 'locked'
  else if (s.status === 'trial' && (s.trialDaysLeft ?? 0) > 0) {
    mode = (s.trialDaysLeft ?? 99) <= 5 ? 'countdown' : 'none'
  } else {
    // trial ended (status expired, or trial with no days left)
    mode = s.daysSinceEnd <= GRACE_DAYS ? 'grace' : 'locked'
  }

  if (mode === 'none') return null

  const SubscribeBtn = ({ full }: { full?: boolean }) => (
    <button onClick={subscribe} disabled={checkingOut}
      className={`btn-primary justify-center ${full ? 'w-full' : ''}`}>
      {checkingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
      Set up payment
    </button>
  )

  // Slim, dismissible countdown during the final days of the trial.
  if (mode === 'countdown') {
    if (dismissed) return null
    const d = s.trialDaysLeft ?? 0
    return (
      <div className="fixed top-[68px] lg:top-[92px] left-1/2 -translate-x-1/2 z-[90] w-[min(92vw,560px)]">
        <div className="flex items-center gap-3 bg-[#1b1d23] border border-[#F4A523]/40 rounded-xl shadow-xl px-4 py-2.5">
          <Clock className="w-4 h-4 text-[#F4A523] shrink-0" />
          <span className="text-sm text-zinc-200 flex-1">
            {d === 1 ? 'Your trial ends tomorrow.' : `Your trial ends in ${d} days.`} Set up payment to keep GarageDash running.
          </span>
          <button onClick={subscribe} disabled={checkingOut} className="btn-primary text-xs py-1 px-2.5 shrink-0">
            {checkingOut ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Subscribe'}
          </button>
          <button onClick={() => setDismissed(true)} className="text-zinc-500 hover:text-white shrink-0"><X className="w-4 h-4" /></button>
        </div>
      </div>
    )
  }

  // Trial ended — dismissible for the grace window.
  if (mode === 'grace') {
    if (dismissed) return null
    const left = Math.max(0, GRACE_DAYS - s.daysSinceEnd)
    return (
      <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl w-full max-w-md p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-[#F4A523]/15 flex items-center justify-center mx-auto mb-4">
            <Clock className="w-6 h-6 text-[#F4A523]" />
          </div>
          <h2 className="text-lg font-semibold text-white mb-1">Your free trial has ended</h2>
          <p className="text-sm text-zinc-400 mb-5">
            Hope you've been enjoying GarageDash! Set up payment to keep everything running with no interruption.
            {left > 0 && <> You can keep using it for <span className="text-zinc-200 font-medium">{left} more day{left !== 1 ? 's' : ''}</span> before payment is required.</>}
          </p>
          <div className="space-y-2">
            <SubscribeBtn full />
            <button onClick={() => setDismissed(true)} className="btn-ghost w-full justify-center text-sm">Remind me later</button>
          </div>
        </div>
      </div>
    )
  }

  // Hard lock — must subscribe to continue.
  return (
    <div className="fixed inset-0 z-[100] bg-[#0f1117] flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl w-full max-w-md p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-4">
          <Lock className="w-6 h-6 text-[#F4A523]" />
        </div>
        <h2 className="text-lg font-semibold text-white mb-1">
          {s.status === 'cancelled' ? 'Your subscription has ended' : 'Your trial has ended'}
        </h2>
        <p className="text-sm text-zinc-400 mb-5">
          Set up payment to unlock GarageDash again. Your data is safe and will be exactly as you left it.
        </p>
        <div className="space-y-2">
          <SubscribeBtn full />
          <button onClick={() => signOut()} className="btn-ghost w-full justify-center text-sm text-zinc-500">Sign out</button>
        </div>
        <p className="text-xs text-zinc-600 mt-4">Already paid? Sign out and back in, or contact support if it doesn't unlock.</p>
      </div>
    </div>
  )
}

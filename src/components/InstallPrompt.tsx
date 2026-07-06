import { useEffect, useState } from 'react'
import { Download, Share, X } from 'lucide-react'

const DISMISS_KEY = 'garagely-install-dismissed'

// Lightweight "install this app" hint. Self-guards so it only ever shows in a
// mobile browser tab that isn't already installed — inert on desktop/Electron
// and when running as the installed PWA.
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<any>(null) // Android beforeinstallprompt event
  const [show, setShow] = useState(false)
  const [isIOS, setIsIOS] = useState(false)

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISS_KEY)) return
    } catch { /* ignore */ }

    const standalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      (navigator as any).standalone === true
    if (standalone) return // already installed

    const ua = navigator.userAgent || ''
    const ios = /iphone|ipad|ipod/i.test(ua)
    const android = /android/i.test(ua)
    if (!ios && !android) return // desktop / Electron — don't show

    if (ios) {
      setIsIOS(true)
      setShow(true)
      return
    }

    // Android: wait for the browser's install event.
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setDeferred(e)
      setShow(true)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  const dismiss = () => {
    setShow(false)
    try { localStorage.setItem(DISMISS_KEY, '1') } catch { /* ignore */ }
  }

  const install = async () => {
    if (!deferred) return
    deferred.prompt()
    try { await deferred.userChoice } catch { /* ignore */ }
    dismiss()
  }

  if (!show) return null

  return (
    <div className="fixed inset-x-3 bottom-3 z-[96] pwa-safe-bottom lg:hidden">
      <div className="flex items-center gap-3 bg-[#16181D] border border-[#F4A523]/40 rounded-2xl shadow-2xl px-4 py-3">
        <img src="/assets/pwa-192.png" alt="" className="w-9 h-9 rounded-lg shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-white">Install GarageDash</div>
          {isIOS ? (
            <div className="text-xs text-zinc-400 flex items-center gap-1 flex-wrap">
              Tap <Share className="w-3.5 h-3.5 inline text-blue-400" /> then “Add to Home Screen”
            </div>
          ) : (
            <div className="text-xs text-zinc-400">Add it to your home screen for a full-screen app.</div>
          )}
        </div>
        {!isIOS && (
          <button onClick={install} className="btn-primary text-xs py-1.5 px-3 shrink-0">
            <Download className="w-4 h-4" /> Install
          </button>
        )}
        <button onClick={dismiss} className="text-zinc-500 hover:text-white shrink-0"><X className="w-4 h-4" /></button>
      </div>
    </div>
  )
}

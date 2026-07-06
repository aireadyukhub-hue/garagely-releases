import { useState, useEffect } from 'react'
import { Download, Sparkles, X } from 'lucide-react'

export default function UpdateBanner() {
  const [updateVersion, setUpdateVersion] = useState<string | null>(null)
  const [downloaded, setDownloaded] = useState(false)
  const [dismissedToast, setDismissedToast] = useState(false)
  const [dismissedModal, setDismissedModal] = useState(false)
  const [restarting, setRestarting] = useState(false)

  useEffect(() => {
    if (!window.api?.onUpdateAvailable) return

    window.api.onUpdateAvailable(({ version }: { version: string }) => {
      setUpdateVersion(version)
    })

    window.api.onUpdateDownloaded(({ version }: { version: string }) => {
      setUpdateVersion(version)
      setDownloaded(true)
      setDismissedModal(false) // a freshly-downloaded update re-opens the prompt
    })
  }, [])

  const restart = () => {
    setRestarting(true)
    window.api?.installUpdate()
  }

  // ── Update downloaded → centered restart prompt ───────────────────────────
  if (updateVersion && downloaded && !dismissedModal) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="w-[400px] max-w-[90vw] bg-[#16181D] border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">
          <div className="p-6 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-[#F4A523]/15 flex items-center justify-center mb-4">
              <Sparkles className="w-6 h-6 text-[#F4A523]" />
            </div>
            <h2 className="text-white text-lg font-semibold">Update ready</h2>
            <p className="text-zinc-400 text-sm mt-1.5">
              GarageDash <span className="text-zinc-200 font-medium">v{updateVersion}</span> has been
              downloaded. Restart now to finish updating.
            </p>
          </div>
          <div className="flex gap-2 px-6 pb-6">
            <button
              onClick={() => setDismissedModal(true)}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-zinc-300 bg-zinc-800/70 hover:bg-zinc-800 transition-colors"
            >
              Later
            </button>
            <button
              onClick={restart}
              disabled={restarting}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-[#16181D] bg-[#F4A523] hover:bg-[#f5b347] transition-colors disabled:opacity-70"
            >
              {restarting ? 'Restarting…' : 'Restart & update'}
            </button>
          </div>
          <p className="text-center text-zinc-600 text-xs pb-4 px-6">
            Or it'll update automatically next time you close GarageDash.
          </p>
        </div>
      </div>
    )
  }

  // ── Update downloaded but user clicked "Later" → small reminder pill ───────
  if (updateVersion && downloaded && dismissedModal) {
    return (
      <button
        onClick={() => setDismissedModal(false)}
        className="fixed bottom-4 right-4 z-50 flex items-center gap-2 bg-[#1F2128] border border-[#F4A523]/40 rounded-full pl-3 pr-4 py-2 shadow-xl hover:border-[#F4A523]/70 transition-colors"
      >
        <Sparkles className="w-4 h-4 text-[#F4A523]" />
        <span className="text-white text-sm font-medium">Restart to update</span>
      </button>
    )
  }

  // ── Update downloading → unobtrusive corner toast ─────────────────────────
  if (updateVersion && !downloaded && !dismissedToast) {
    return (
      <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 bg-[#1F2128] border border-zinc-800 rounded-xl px-4 py-3 shadow-xl max-w-sm">
        <Download className="w-4 h-4 text-[#F4A523] animate-bounce flex-shrink-0" />
        <p className="text-zinc-300 text-sm flex-1">Downloading update v{updateVersion}…</p>
        <button onClick={() => setDismissedToast(true)} className="text-zinc-600 hover:text-white flex-shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>
    )
  }

  return null
}

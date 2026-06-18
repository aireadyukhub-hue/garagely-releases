import { useState, useEffect } from 'react'
import { Download, RefreshCw, X } from 'lucide-react'

export default function UpdateBanner() {
  const [updateVersion, setUpdateVersion] = useState<string | null>(null)
  const [downloaded, setDownloaded] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!window.api?.onUpdateAvailable) return

    window.api.onUpdateAvailable(({ version }) => {
      setUpdateVersion(version)
    })

    window.api.onUpdateDownloaded(({ version }) => {
      setUpdateVersion(version)
      setDownloaded(true)
    })
  }, [])

  if (!updateVersion || dismissed) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 bg-[#1F2128] border border-[#F4A523]/40 rounded-xl px-4 py-3 shadow-xl max-w-sm">
      <div className="flex-shrink-0 text-[#F4A523]">
        {downloaded ? <RefreshCw className="w-4 h-4" /> : <Download className="w-4 h-4 animate-bounce" />}
      </div>
      <div className="flex-1 min-w-0">
        {downloaded ? (
          <>
            <p className="text-white text-sm font-medium">Update ready — v{updateVersion}</p>
            <button
              onClick={() => window.api.installUpdate()}
              className="text-[#F4A523] text-xs hover:underline mt-0.5"
            >
              Restart to install
            </button>
          </>
        ) : (
          <p className="text-white text-sm">Downloading update v{updateVersion}…</p>
        )}
      </div>
      <button onClick={() => setDismissed(true)} className="text-[#6B7280] hover:text-white flex-shrink-0">
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

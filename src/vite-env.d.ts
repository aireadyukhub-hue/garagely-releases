/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_BACKEND_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// Electron preload bridge — present on desktop only, undefined on the web.
interface Window {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  api?: Record<string, any>
}

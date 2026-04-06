/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_META_APP_ID?: string
  readonly VITE_META_REDIRECT_URI?: string
  readonly VITE_META_WORKER_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare const GITHUB_RUNTIME_PERMANENT_NAME: string
declare const BASE_KV_SERVICE_URL: string
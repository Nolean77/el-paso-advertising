const DEFAULT_META_REDIRECT_URI = 'https://ep-meta-poster.workers.dev/oauth/meta/callback'

export const META_WORKER_BASE_URL = (
  import.meta.env.VITE_META_WORKER_URL ||
  (import.meta.env.VITE_META_REDIRECT_URI || DEFAULT_META_REDIRECT_URI).replace(/\/oauth\/meta\/callback$/, '')
).replace(/\/$/, '')

export interface MetricSyncResult {
  ok?: boolean
  checkedCount?: number
  syncedCount?: number
  skippedCount?: number
  errors?: Array<{ postId?: string; message?: string }>
  error?: string
}

export async function syncFacebookMetricsForClient(clientId: string) {
  if (!clientId || !META_WORKER_BASE_URL) {
    return null
  }

  const response = await fetch(`${META_WORKER_BASE_URL}/metrics/sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      clientId,
      platform: 'facebook',
    }),
  })

  const result = await response.json().catch(() => ({} as MetricSyncResult)) as MetricSyncResult

  if (!response.ok || !result.ok) {
    throw new Error(result.error || 'Unable to sync Facebook metrics.')
  }

  return result
}

import { Button } from '@/components/ui/button'

interface MetaConnectButtonProps {
  clientId: string
  className?: string
}

const REDIRECT_URI = import.meta.env.VITE_META_REDIRECT_URI || 'https://ep-meta-poster.workers.dev/oauth/meta/callback'
const SCOPES = [
  'pages_manage_posts',
  'pages_read_engagement',
  'pages_show_list',
  'read_insights',
].join(',')

export function MetaConnectButton({ clientId, className }: MetaConnectButtonProps) {
  const metaAppId = import.meta.env.VITE_META_APP_ID

  const handleConnect = () => {
    if (!metaAppId) {
      return
    }

    const authUrl =
      `https://www.facebook.com/v19.0/dialog/oauth?` +
      `client_id=${encodeURIComponent(metaAppId)}` +
      `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
      `&scope=${encodeURIComponent(SCOPES)}` +
      `&state=${encodeURIComponent(clientId)}` +
      `&response_type=code` +
      `&auth_type=rerequest` +
      `&return_scopes=true`

    window.location.href = authUrl
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleConnect}
      disabled={!metaAppId}
      className={className}
    >
      Connect Facebook & Instagram
    </Button>
  )
}

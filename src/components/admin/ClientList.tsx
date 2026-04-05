import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ClientProfile, MetaConnection } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MetaConnectButton } from '@/components/admin/MetaConnectButton'
import { format } from 'date-fns'

interface ClientListProps {
  selectedClientId?: string
  onSelectClient?: (clientId: string) => void
}

export function ClientList({ selectedClientId, onSelectClient }: ClientListProps) {
  const [clients, setClients] = useState<ClientProfile[]>([])
  const [connectionMap, setConnectionMap] = useState<Record<string, MetaConnection>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase
        .from('profiles')
        .select('*')
        .ilike('role', 'client')
        .order('created_at', { ascending: false }),
      supabase
        .from('meta_connections')
        .select('id, client_id, facebook_page_id, facebook_page_name, instagram_account_id, token_expires_at, connected_at, is_active')
        .eq('is_active', true),
    ]).then(([clientsRes, connectionsRes]) => {
      setClients((clientsRes.data as ClientProfile[]) ?? [])

      const connectionByClient: Record<string, MetaConnection> = {}
      const activeConnections = (connectionsRes.data as MetaConnection[]) ?? []

      for (const connection of activeConnections) {
        const existing = connectionByClient[connection.client_id]
        if (!existing) {
          connectionByClient[connection.client_id] = connection
          continue
        }

        const existingTs = existing.connected_at ? new Date(existing.connected_at).getTime() : 0
        const nextTs = connection.connected_at ? new Date(connection.connected_at).getTime() : 0
        if (nextTs >= existingTs) {
          connectionByClient[connection.client_id] = connection
        }
      }

      setConnectionMap(connectionByClient)
      setLoading(false)
    })
  }, [])

  if (loading) return <p className="text-muted-foreground">Loading clients...</p>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Clients</h2>
          <p className="text-sm text-muted-foreground">
            Choose the active client here. The other tabs will follow this selection.
          </p>
        </div>
        <Badge variant="secondary">{clients.length} total</Badge>
      </div>

      {clients.length === 0 ? (
        <p className="text-muted-foreground">No clients yet. Add users via Supabase Authentication → Users.</p>
      ) : (
        <div className="space-y-3">
          {clients.map((client) => {
            const isActive = selectedClientId === client.id
            const metaConnection = connectionMap[client.id]
            const metaConnected = Boolean(metaConnection)

            return (
              <Card key={client.id} className={isActive ? 'border-primary shadow-sm shadow-primary/10' : ''}>
                <CardContent className="p-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{client.name}</p>
                      {isActive && <Badge variant="default">Active Client</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">{client.id}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Joined {format(new Date(client.created_at), 'PPP')}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge variant={metaConnected ? 'default' : 'secondary'}>
                        {metaConnected ? 'Meta Connected' : 'Meta Not Connected'}
                      </Badge>
                      {metaConnected && metaConnection.facebook_page_name && (
                        <Badge variant="outline">Page: {metaConnection.facebook_page_name}</Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <MetaConnectButton clientId={client.id} />
                    <Badge>{client.role}</Badge>
                    <Button
                      type="button"
                      variant={isActive ? 'default' : 'outline'}
                      onClick={() => onSelectClient?.(client.id)}
                    >
                      {isActive ? 'Currently Selected' : 'Work With Client'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
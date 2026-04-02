import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ClientProfile } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'

interface ClientListProps {
  selectedClientId?: string
  onSelectClient?: (clientId: string) => void
}

export function ClientList({ selectedClientId, onSelectClient }: ClientListProps) {
  const [clients, setClients] = useState<ClientProfile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('profiles')
      .select('*')
      .ilike('role', 'client')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setClients((data as ClientProfile[]) ?? [])
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
                  </div>

                  <div className="flex items-center gap-2">
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
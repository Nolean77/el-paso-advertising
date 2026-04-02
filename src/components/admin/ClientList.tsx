import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ClientProfile } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'

export function ClientList() {
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
        <h2 className="text-2xl font-bold">Clients</h2>
        <Badge variant="secondary">{clients.length} total</Badge>
      </div>

      {clients.length === 0 ? (
        <p className="text-muted-foreground">No clients yet. Add users via Supabase Authentication → Users.</p>
      ) : (
        <div className="space-y-3">
          {clients.map((client) => (
            <Card key={client.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold">{client.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{client.id}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Joined {format(new Date(client.created_at), 'PPP')}
                  </p>
                </div>
                <Badge>{client.role}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
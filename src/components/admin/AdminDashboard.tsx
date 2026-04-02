import { useEffect, useState } from 'react'
import { ClientProfile } from '@/lib/types'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Users, CalendarDays, CheckSquare, MessageSquare } from 'lucide-react'

interface AdminDashboardProps {
  selectedClientId?: string
  selectedClientName?: string
  clients: ClientProfile[]
  onSelectClient: (clientId: string) => void
}

export function AdminDashboard({ selectedClientId, selectedClientName, clients, onSelectClient }: AdminDashboardProps) {
  const [counts, setCounts] = useState({
    clients: 0, posts: 0, pending: 0, requests: 0
  })

  useEffect(() => {
    async function load() {
      const clientsQuery = supabase.from('profiles').select('id', { count: 'exact' }).ilike('role', 'client')
      const postsQuery = supabase.from('scheduled_posts').select('id', { count: 'exact' })
      const pendingQuery = supabase.from('approval_posts').select('id', { count: 'exact' }).eq('status', 'pending')
      const requestsQuery = supabase.from('content_requests').select('id', { count: 'exact' }).eq('status', 'pending')

      if (selectedClientId) {
        postsQuery.eq('user_id', selectedClientId)
        pendingQuery.eq('user_id', selectedClientId)
        requestsQuery.eq('user_id', selectedClientId)
      }

      const [clients, posts, pending, requests] = await Promise.all([
        clientsQuery,
        postsQuery,
        pendingQuery,
        requestsQuery,
      ])

      setCounts({
        clients:  clients.count  ?? 0,
        posts:    posts.count    ?? 0,
        pending:  pending.count  ?? 0,
        requests: requests.count ?? 0,
      })
    }

    load()
  }, [selectedClientId])

  const stats = [
    { label: 'Active Clients',    value: counts.clients,  icon: Users },
    { label: 'Scheduled Posts',   value: counts.posts,    icon: CalendarDays },
    { label: 'Pending Approvals', value: counts.pending,  icon: CheckSquare },
    { label: 'Open Requests',     value: counts.requests, icon: MessageSquare },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Dashboard</h2>
          <p className="text-sm text-muted-foreground">
            {selectedClientName
              ? <>Currently viewing <span className="font-medium text-foreground">{selectedClientName}</span>.</>
              : 'Select a client here to focus the admin workspace.'}
          </p>
        </div>

        <div className="w-full lg:max-w-sm space-y-2">
          <Label htmlFor="dashboard-client-switcher">Working client</Label>
          <Select value={selectedClientId} onValueChange={onSelectClient} disabled={clients.length === 0}>
            <SelectTrigger id="dashboard-client-switcher">
              <SelectValue placeholder={clients.length === 0 ? 'No clients available' : 'Select a client'} />
            </SelectTrigger>
            <SelectContent>
              {clients.map((client) => (
                <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {stats.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
              <Icon size={18} className="text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
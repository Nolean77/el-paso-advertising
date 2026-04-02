import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ContentRequest, ClientProfile } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { format } from 'date-fns'

export function RequestManager() {
  const [requests, setRequests] = useState<ContentRequest[]>([])
  const [clients, setClients] = useState<ClientProfile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('content_requests').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*').eq('role', 'client'),
    ]).then(([reqRes, clientRes]) => {
      setRequests((reqRes.data as ContentRequest[]) ?? [])
      setClients((clientRes.data as ClientProfile[]) ?? [])
      setLoading(false)
    })
  }, [])

  const getClientName = (userId: string) =>
    clients.find(c => c.id === userId)?.name ?? 'Unknown'

  const updateStatus = async (id: string, status: ContentRequest['status']) => {
    const { error } = await supabase
      .from('content_requests')
      .update({ status })
      .eq('id', id)

    if (error) {
      toast.error('Failed to update status')
    } else {
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r))
      toast.success('Status updated!')
    }
  }

  const statusColor = (status: string) => {
    if (status === 'completed') return 'bg-green-500/20 text-green-500'
    if (status === 'inProgress') return 'bg-blue-500/20 text-blue-500'
    return 'bg-yellow-500/20 text-yellow-500'
  }

  if (loading) return <p className="text-muted-foreground">Loading requests...</p>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Content Requests</h2>
        <Badge variant="secondary">{requests.length} total</Badge>
      </div>

      {requests.length === 0 ? (
        <p className="text-muted-foreground">No requests yet.</p>
      ) : (
        <div className="space-y-3">
          {requests.map(req => (
            <Card key={req.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold">{req.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {getClientName(req.user_id)} · {format(new Date(req.created_at), 'PPP')}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">{req.description}</p>
                  </div>
                  <Badge className={statusColor(req.status)}>{req.status}</Badge>
                </div>

                <Select
                  defaultValue={req.status}
                  onValueChange={(val) => updateStatus(req.id, val as ContentRequest['status'])}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="inProgress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
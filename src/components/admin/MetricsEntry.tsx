import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ClientProfile } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

export function MetricsEntry() {
  const [clients, setClients] = useState<ClientProfile[]>([])
  const [clientId, setClientId] = useState('')
  const [platform, setPlatform] = useState('')
  const [caption, setCaption] = useState('')
  const [date, setDate] = useState('')
  const [reach, setReach] = useState('')
  const [likes, setLikes] = useState('')
  const [engagementRate, setEngagementRate] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from('profiles').select('*').ilike('role', 'client')
      .then(({ data }) => setClients((data as ClientProfile[]) ?? []))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clientId || !platform || !caption || !date || !reach || !likes || !engagementRate) {
      toast.error('Please fill in all fields')
      return
    }
    setSaving(true)
    const { error } = await supabase.from('performance_metrics').insert({
      user_id: clientId,
      platform,
      caption,
      date,
      reach: parseInt(reach),
      likes: parseInt(likes),
      engagement_rate: parseFloat(engagementRate),
    })
    setSaving(false)
    if (error) {
      toast.error('Failed: ' + error.message)
    } else {
      toast.success('Metrics saved!')
      setCaption('')
      setReach('')
      setLikes('')
      setEngagementRate('')
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-2xl font-bold">Enter Performance Metrics</h2>
      <Card>
        <CardHeader><CardTitle>New Metric Entry</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Client</Label>
              <Select onValueChange={setClientId}>
                <SelectTrigger><SelectValue placeholder="Select a client" /></SelectTrigger>
                <SelectContent>
                  {clients.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Platform</Label>
                <Select onValueChange={setPlatform}>
                  <SelectTrigger><SelectValue placeholder="Platform" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="instagram">Instagram</SelectItem>
                    <SelectItem value="facebook">Facebook</SelectItem>
                    <SelectItem value="twitter">Twitter</SelectItem>
                    <SelectItem value="linkedin">LinkedIn</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Post Caption / Description</Label>
              <Textarea value={caption} onChange={e => setCaption(e.target.value)} rows={2} />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Reach</Label>
                <Input type="number" value={reach} onChange={e => setReach(e.target.value)} placeholder="12500" />
              </div>
              <div className="space-y-2">
                <Label>Likes</Label>
                <Input type="number" value={likes} onChange={e => setLikes(e.target.value)} placeholder="890" />
              </div>
              <div className="space-y-2">
                <Label>Engagement %</Label>
                <Input type="number" step="0.01" value={engagementRate} onChange={e => setEngagementRate(e.target.value)} placeholder="7.12" />
              </div>
            </div>

            <Button type="submit" disabled={saving} className="w-full">
              {saving ? 'Saving...' : 'Save Metrics'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
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

export function PostScheduler() {
  const [clients, setClients] = useState<ClientProfile[]>([])
  const [clientId, setClientId] = useState('')
  const [date, setDate] = useState('')
  const [platform, setPlatform] = useState('')
  const [caption, setCaption] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from('profiles').select('*').eq('role', 'client')
      .then(({ data }) => setClients((data as ClientProfile[]) ?? []))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clientId || !date || !platform || !caption || !imageUrl) {
      toast.error('Please fill in all fields')
      return
    }
    setSaving(true)
    const { error } = await supabase.from('scheduled_posts').insert({
      user_id: clientId,
      date,
      platform,
      caption,
      image_url: imageUrl,
      status: 'scheduled',
    })
    setSaving(false)
    if (error) {
      toast.error('Failed to schedule post: ' + error.message)
    } else {
      toast.success('Post scheduled!')
      setCaption('')
      setImageUrl('')
      setDate('')
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-2xl font-bold">Schedule a Post</h2>
      <Card>
        <CardHeader><CardTitle>New Scheduled Post</CardTitle></CardHeader>
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
                  <SelectTrigger><SelectValue placeholder="Select platform" /></SelectTrigger>
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
              <Label>Caption</Label>
              <Textarea value={caption} onChange={e => setCaption(e.target.value)} rows={4} />
            </div>

            <div className="space-y-2">
              <Label>Image URL</Label>
              <Input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://..." />
            </div>

            <Button type="submit" disabled={saving} className="w-full">
              {saving ? 'Scheduling...' : 'Schedule Post'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
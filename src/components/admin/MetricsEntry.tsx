import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

interface MetricsEntryProps {
  selectedClientId?: string
  selectedClientName?: string
}

export function MetricsEntry({ selectedClientId, selectedClientName }: MetricsEntryProps) {
  const [platform, setPlatform] = useState('')
  const [caption, setCaption] = useState('')
  const [date, setDate] = useState('')
  const [reach, setReach] = useState('')
  const [likes, setLikes] = useState('')
  const [engagementRate, setEngagementRate] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedClientId) {
      toast.error('Select a client from the portal header first.')
      return
    }

    if (!platform || !caption || !date || !reach || !likes || !engagementRate) {
      toast.error('Please fill in all fields')
      return
    }

    setSaving(true)
    const { error } = await supabase.from('performance_metrics').insert({
      user_id: selectedClientId,
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
      <div>
        <h2 className="text-2xl font-bold">Enter Performance Metrics</h2>
        <p className="text-sm text-muted-foreground">
          {selectedClientName
            ? <>Saving metrics for <span className="font-medium text-foreground">{selectedClientName}</span>.</>
            : 'Select a client above to continue.'}
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle>New Metric Entry</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Client</Label>
              <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                {selectedClientName || 'No client selected'}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Platform</Label>
                <Select value={platform} onValueChange={setPlatform}>
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

            <Button type="submit" disabled={saving || !selectedClientId} className="w-full">
              {saving ? 'Saving...' : 'Save Metrics'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
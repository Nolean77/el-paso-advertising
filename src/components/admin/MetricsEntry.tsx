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

const DEFAULT_META_REDIRECT_URI = 'https://ep-meta-poster.workers.dev/oauth/meta/callback'
const META_WORKER_BASE_URL = (
  import.meta.env.VITE_META_WORKER_URL ||
  (import.meta.env.VITE_META_REDIRECT_URI || DEFAULT_META_REDIRECT_URI).replace(/\/oauth\/meta\/callback$/, '')
).replace(/\/$/, '')

export function MetricsEntry({ selectedClientId, selectedClientName }: MetricsEntryProps) {
  const [platform, setPlatform] = useState('')
  const [caption, setCaption] = useState('')
  const [date, setDate] = useState('')
  const [reach, setReach] = useState('')
  const [likes, setLikes] = useState('')
  const [engagementRate, setEngagementRate] = useState('')
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)

  const handlePullFacebookMetrics = async () => {
    if (!selectedClientId) {
      toast.error('Select a client from the portal header first.')
      return
    }

    if (!META_WORKER_BASE_URL) {
      toast.error('Meta worker URL is not configured.')
      return
    }

    setSyncing(true)

    try {
      const response = await fetch(`${META_WORKER_BASE_URL}/metrics/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientId: selectedClientId,
          platform: 'facebook',
        }),
      })

      const result = await response.json().catch(() => ({}))

      if (!response.ok || !result.ok) {
        throw new Error(result.error || 'Unable to pull Facebook metrics.')
      }

      if ((result.checkedCount ?? 0) === 0) {
        toast('No posted Facebook content was found yet for this client.')
        return
      }

      if ((result.syncedCount ?? 0) > 0) {
        toast.success(`Facebook metrics synced for ${result.syncedCount} post${result.syncedCount === 1 ? '' : 's'}.`)
        return
      }

      const firstError = Array.isArray(result.errors) && result.errors.length > 0
        ? result.errors[0]?.message
        : 'No Facebook posts could be synced right now.'

      throw new Error(firstError || 'No Facebook posts could be synced right now.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to pull Facebook metrics.')
    } finally {
      setSyncing(false)
    }
  }

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
        <h2 className="text-2xl font-bold">Pull or Enter Performance Metrics</h2>
        <p className="text-sm text-muted-foreground">
          {selectedClientName
            ? <>Managing metrics for <span className="font-medium text-foreground">{selectedClientName}</span>.</>
            : 'Select a client above to continue.'}
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle>Facebook Sync</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Pull the latest reach, likes, and engagement data from the client&apos;s connected Facebook page.
          </p>
          <Button
            type="button"
            variant="secondary"
            onClick={handlePullFacebookMetrics}
            disabled={syncing || !selectedClientId || !META_WORKER_BASE_URL}
            className="w-full"
          >
            {syncing ? 'Pulling Facebook Metrics...' : 'Pull Facebook Metrics'}
          </Button>
          <p className="text-xs text-muted-foreground">
            If this client connected before insights access was enabled, reconnect the Meta account once and run the sync again.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Manual Metric Entry</CardTitle></CardHeader>
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
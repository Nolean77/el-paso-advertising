import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ApprovalPost } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { buildApprovalImagePlaceholder, encodeApprovalCaption } from '@/lib/utils'
import { ImageUploadField } from '@/components/ImageUploadField'

interface PostSchedulerProps {
  selectedClientId?: string
  selectedClientName?: string
}

export function PostScheduler({ selectedClientId, selectedClientName }: PostSchedulerProps) {
  const [scheduledAt, setScheduledAt] = useState(() => {
    const now = new Date()
    now.setMinutes(now.getMinutes() + 15)
    return now.toISOString().slice(0, 16)
  })
  const [autoPostEnabled, setAutoPostEnabled] = useState(true)
  const [platform, setPlatform] = useState<ApprovalPost['platform'] | ''>('')
  const [caption, setCaption] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedClientId) {
      toast.error('Select a client from the portal header first.')
      return
    }

    if (!scheduledAt || !platform || !caption.trim()) {
      toast.error('Please fill in the publish schedule, platform, and caption.')
      return
    }

    setSaving(true)

    const encodedCaption = encodeApprovalCaption(caption, {
      requestedBy: 'admin',
      requestedDate: new Date(scheduledAt).toISOString(),
      autoPostEnabled,
      postType: 'photo',
    })

    const { error } = await supabase.from('approval_posts').insert({
      user_id: selectedClientId,
      platform,
      caption: encodedCaption,
      image_url: imageUrl.trim() || buildApprovalImagePlaceholder(caption),
      status: 'pending',
    })

    setSaving(false)

    if (error) {
      toast.error('Failed to send post to approvals: ' + error.message)
    } else {
      toast.success('Post sent to approvals. It will move to the calendar after approval.')
      setCaption('')
      setImageUrl('')
      const now = new Date()
      now.setMinutes(now.getMinutes() + 15)
      setScheduledAt(now.toISOString().slice(0, 16))
      setAutoPostEnabled(true)
      setPlatform('')
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold">Create Post for Approval</h2>
        <p className="text-sm text-muted-foreground">
          {selectedClientName
            ? <>Working with <span className="font-medium text-foreground">{selectedClientName}</span>.</>
            : 'Select a client above to keep this tab in sync.'}
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle>New Post Draft</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Client</Label>
              <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                {selectedClientName || 'No client selected'}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Schedule For</Label>
                <Input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={e => setScheduledAt(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Platform</Label>
                <Select value={platform} onValueChange={(value) => setPlatform(value as ApprovalPost['platform'])}>
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

            <div className="flex items-start gap-2 rounded-md border border-border bg-muted/20 px-3 py-2">
              <input
                id="admin-postscheduler-autopost"
                type="checkbox"
                checked={autoPostEnabled}
                onChange={(event) => setAutoPostEnabled(event.target.checked)}
                className="mt-1"
              />
              <Label htmlFor="admin-postscheduler-autopost" className="text-sm leading-5">
                Auto-post when approved and schedule time is reached.
              </Label>
            </div>

            <div className="space-y-2">
              <Label>Caption</Label>
              <Textarea value={caption} onChange={e => setCaption(e.target.value)} rows={4} />
            </div>

            <ImageUploadField
              label="Post Image"
              value={imageUrl}
              onChange={setImageUrl}
              helperText="Drag and drop a photo, upload one from your device, or paste an image URL."
            />

            <Button type="submit" disabled={saving || !selectedClientId} className="w-full">
              {saving ? 'Sending...' : 'Send to Approvals'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
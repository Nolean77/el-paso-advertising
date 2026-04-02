import { useEffect, useState } from 'react'
import { CheckCircle, ChatCircle, PencilSimple } from '@phosphor-icons/react'
import { format } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { ApprovalPost } from '@/lib/types'
import { buildApprovalImagePlaceholder, encodeApprovalCaption, parseApprovalCaption } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

interface ApprovalManagerProps {
  selectedClientId?: string
  selectedClientName?: string
}

export function ApprovalManager({ selectedClientId, selectedClientName }: ApprovalManagerProps) {
  const [posts, setPosts] = useState<ApprovalPost[]>([])
  const [scheduledDate, setScheduledDate] = useState(() => new Date().toISOString().split('T')[0])
  const [platform, setPlatform] = useState<ApprovalPost['platform'] | ''>('')
  const [caption, setCaption] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [activeComment, setActiveComment] = useState<string | null>(null)
  const [commentText, setCommentText] = useState('')

  useEffect(() => {
    supabase.from('approval_posts').select('*').order('created_at', { ascending: false })
      .then(({ data }) => setPosts((data as ApprovalPost[]) ?? []))
  }, [])

  const filteredPosts = selectedClientId
    ? posts.filter((post) => post.user_id === selectedClientId)
    : posts

  const syncRequestStatus = async (post: ApprovalPost, status: ApprovalPost['status']) => {
    const { meta } = parseApprovalCaption(post.caption)
    if (!meta.sourceRequestId) return

    const requestStatus = status === 'approved' ? 'completed' : 'inProgress'
    await supabase
      .from('content_requests')
      .update({ status: requestStatus })
      .eq('id', meta.sourceRequestId)
      .eq('user_id', post.user_id)
  }

  const addPostToCalendar = async (post: ApprovalPost) => {
    const { caption: visibleCaption, meta } = parseApprovalCaption(post.caption)
    const scheduledDateValue = meta.requestedDate || new Date().toISOString().split('T')[0]

    const { data: existingPosts, error: existingError } = await supabase
      .from('scheduled_posts')
      .select('id')
      .eq('user_id', post.user_id)
      .eq('date', scheduledDateValue)
      .eq('platform', post.platform)
      .eq('caption', visibleCaption)
      .limit(1)

    if (existingError) {
      toast.error('Approved, but the calendar could not be checked for duplicates.')
      return
    }

    if (existingPosts && existingPosts.length > 0) {
      toast.success('This approved item is already on the content calendar.')
      return
    }

    const { error: scheduleError } = await supabase.from('scheduled_posts').insert({
      user_id: post.user_id,
      date: scheduledDateValue,
      platform: post.platform,
      caption: visibleCaption,
      image_url: post.image_url || buildApprovalImagePlaceholder(meta.title || visibleCaption),
      status: 'scheduled',
    })

    if (scheduleError) {
      toast.error('Approved, but it could not be added to the content calendar.')
      return
    }

    toast.success('Approved and added to the content calendar!')
  }

  const updatePostStatus = async (post: ApprovalPost, status: ApprovalPost['status'], feedback?: string) => {
    const { error } = await supabase
      .from('approval_posts')
      .update({ status, feedback: feedback || null })
      .eq('id', post.id)

    if (error) {
      toast.error('Failed to update the approval item.')
      return
    }

    setPosts((currentPosts) =>
      currentPosts.map((currentPost) =>
        currentPost.id === post.id
          ? { ...currentPost, status, feedback: feedback || currentPost.feedback }
          : currentPost
      )
    )

    await syncRequestStatus(post, status)

    if (status === 'approved') {
      await addPostToCalendar(post)
      return
    }

    toast.success('Feedback sent back for revision!')
  }

  const handleRequestChanges = async (post: ApprovalPost) => {
    if (activeComment === post.id) {
      await updatePostStatus(post, 'changes-requested', commentText)
      setActiveComment(null)
      setCommentText('')
      return
    }

    setActiveComment(post.id)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedClientId) {
      toast.error('Select a client from the portal header first.')
      return
    }

    if (!platform || !caption.trim()) {
      toast.error('Please choose a platform and enter the caption.')
      return
    }

    setSaving(true)
    const encodedCaption = encodeApprovalCaption(caption, {
      requestedBy: 'admin',
      requestedDate: scheduledDate || undefined,
    })

    const { data, error } = await supabase
      .from('approval_posts')
      .insert({
        user_id: selectedClientId,
        platform,
        caption: encodedCaption,
        image_url: imageUrl.trim() || buildApprovalImagePlaceholder(caption),
        status: 'pending',
      })
      .select()
      .single()

    setSaving(false)

    if (error) {
      toast.error('Failed: ' + error.message)
      return
    }

    toast.success('Sent to the client approval queue!')
    setPosts((currentPosts) => [data as ApprovalPost, ...currentPosts])
    setCaption('')
    setImageUrl('')
    setPlatform('')
    setScheduledDate(new Date().toISOString().split('T')[0])
  }

  const statusColor = (status: string) => {
    if (status === 'approved') return 'bg-green-500/20 text-green-500'
    if (status === 'changes-requested') return 'bg-yellow-500/20 text-yellow-500'
    return 'bg-blue-500/20 text-blue-500'
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold">Approval Manager</h2>
        <p className="text-sm text-muted-foreground">
          {selectedClientName
            ? <>Reviewing approvals for <span className="font-medium text-foreground">{selectedClientName}</span>.</>
            : 'Select a client above to focus the approval queue.'}
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle>Send New Item to Client Approval</CardTitle></CardHeader>
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
                <Label>Platform</Label>
                <Select value={platform} onValueChange={(value) => setPlatform(value as ApprovalPost['platform'])}>
                  <SelectTrigger><SelectValue placeholder="Select platform" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="instagram">Instagram</SelectItem>
                    <SelectItem value="facebook">Facebook</SelectItem>
                    <SelectItem value="twitter">Twitter / X</SelectItem>
                    <SelectItem value="linkedin">LinkedIn</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Target Publish Date</Label>
                <Input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Caption / Request Details</Label>
              <Textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={4} />
            </div>

            <div className="space-y-2">
              <Label>Image URL (optional)</Label>
              <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." />
            </div>

            <Button type="submit" disabled={saving || !selectedClientId} className="w-full">
              {saving ? 'Sending...' : 'Send to Client Approval'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h3 className="font-semibold text-lg">
          Approval Queue ({filteredPosts.filter((post) => post.status === 'pending').length} pending)
        </h3>

        {filteredPosts.length === 0 ? (
          <div className="rounded-md border border-dashed border-border bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
            No approval items for this client yet.
          </div>
        ) : filteredPosts.map((post) => {
          const { caption: visibleCaption, meta } = parseApprovalCaption(post.caption)
          const isClientSubmitted = meta.requestedBy === 'client'

          return (
            <Card key={post.id}>
              <CardContent className="p-4 space-y-4">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={statusColor(post.status)}>{post.status}</Badge>
                      <Badge variant="outline" className="capitalize">{post.platform}</Badge>
                      <Badge variant="secondary">
                        {isClientSubmitted ? 'Client → Admin Review' : 'Admin → Client Approval'}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium">{selectedClientName || 'Selected Client'}</p>
                    <p className="text-sm text-muted-foreground whitespace-pre-line">{visibleCaption}</p>
                    {post.created_at && (
                      <p className="text-xs text-muted-foreground">
                        Submitted {format(new Date(post.created_at), 'PPP')}
                      </p>
                    )}
                  </div>
                </div>

                {post.feedback && (
                  <div className="bg-muted/50 p-3 rounded-md border border-border">
                    <div className="flex items-start gap-2">
                      <ChatCircle size={16} weight="fill" className="text-muted-foreground mt-0.5" />
                      <p className="text-sm text-muted-foreground">{post.feedback}</p>
                    </div>
                  </div>
                )}

                {post.status === 'pending' && isClientSubmitted && (
                  <>
                    {activeComment === post.id && (
                      <Textarea
                        placeholder="Add feedback for the client (optional)"
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        className="min-h-[100px]"
                      />
                    )}

                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button onClick={() => updatePostStatus(post, 'approved')} className="gap-2 flex-1">
                        <CheckCircle size={18} weight="bold" />
                        Approve to Calendar
                      </Button>
                      <Button
                        onClick={() => handleRequestChanges(post)}
                        variant="outline"
                        className="gap-2 flex-1"
                      >
                        <PencilSimple size={18} weight="bold" />
                        {activeComment === post.id ? 'Send Feedback' : 'Request Changes'}
                      </Button>
                    </div>
                  </>
                )}

                {post.status === 'pending' && !isClientSubmitted && (
                  <div className="space-y-2">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button onClick={() => updatePostStatus(post, 'approved')} className="gap-2 flex-1">
                        <CheckCircle size={18} weight="bold" />
                        Approve for Client
                      </Button>
                    </div>
                    <div className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                      Waiting on the client to approve this item before it drops into the content calendar. You can also approve it on their behalf.
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
import { useEffect, useState } from 'react'
import { CheckCircle, ChatCircle, PencilSimple } from '@phosphor-icons/react'
import { format } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { ClientProfile, ApprovalPost } from '@/lib/types'
import { buildApprovalImagePlaceholder, encodeApprovalCaption, parseApprovalCaption } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

export function ApprovalManager() {
  const [clients, setClients] = useState<ClientProfile[]>([])
  const [posts, setPosts] = useState<ApprovalPost[]>([])
  const [clientId, setClientId] = useState('')
  const [scheduledDate, setScheduledDate] = useState(() => new Date().toISOString().split('T')[0])
  const [platform, setPlatform] = useState<ApprovalPost['platform'] | ''>('')
  const [caption, setCaption] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [activeComment, setActiveComment] = useState<string | null>(null)
  const [commentText, setCommentText] = useState('')

  useEffect(() => {
    Promise.all([
      supabase.from('profiles').select('*').ilike('role', 'client'),
      supabase.from('approval_posts').select('*').order('created_at', { ascending: false }),
    ]).then(([clientRes, postRes]) => {
      setClients((clientRes.data as ClientProfile[]) ?? [])
      setPosts((postRes.data as ApprovalPost[]) ?? [])
    })
  }, [])

  const getClientName = (userId: string) =>
    clients.find((client) => client.id === userId)?.name ?? 'Unknown Client'

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
      const { caption: visibleCaption, meta } = parseApprovalCaption(post.caption)
      const { error: scheduleError } = await supabase.from('scheduled_posts').insert({
        user_id: post.user_id,
        date: meta.requestedDate || new Date().toISOString().split('T')[0],
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

    if (!clientId || !platform || !caption.trim()) {
      toast.error('Please select a client, platform, and caption.')
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
        user_id: clientId,
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
    setClientId('')
    setScheduledDate(new Date().toISOString().split('T')[0])
  }

  const statusColor = (status: string) => {
    if (status === 'approved') return 'bg-green-500/20 text-green-500'
    if (status === 'changes-requested') return 'bg-yellow-500/20 text-yellow-500'
    return 'bg-blue-500/20 text-blue-500'
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <h2 className="text-2xl font-bold">Approval Manager</h2>

      <Card>
        <CardHeader><CardTitle>Send New Item to Client Approval</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Client</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger><SelectValue placeholder="Select a client" /></SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

            <Button type="submit" disabled={saving} className="w-full">
              {saving ? 'Sending...' : 'Send to Client Approval'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h3 className="font-semibold text-lg">Approval Queue ({posts.filter((post) => post.status === 'pending').length} pending)</h3>
        {posts.map((post) => {
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
                    <p className="text-sm font-medium">{getClientName(post.user_id)}</p>
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
                  <div className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                    Waiting on the client to approve this item before it drops into the content calendar.
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
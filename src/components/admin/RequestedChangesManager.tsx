import { useEffect, useState } from 'react'
import { ArrowCounterClockwise, ChatCircle, PaperPlaneTilt, Trash } from '@phosphor-icons/react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { supabase } from '@/lib/supabase'
import { buildApprovalImagePlaceholder, encodeApprovalCaption, parseApprovalCaption } from '@/lib/utils'
import type { ApprovalPost } from '@/lib/types'
import { ImageUploadField } from '@/components/ImageUploadField'

interface RequestedChangesManagerProps {
  selectedClientId?: string
  selectedClientName?: string
}

interface ChangeDraft {
  caption: string
  imageUrl: string
  saving?: boolean
}

export function RequestedChangesManager({ selectedClientId, selectedClientName }: RequestedChangesManagerProps) {
  const [posts, setPosts] = useState<ApprovalPost[]>([])
  const [drafts, setDrafts] = useState<Record<string, ChangeDraft>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('approval_posts')
      .select('*')
      .eq('status', 'changes-requested')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        const nextPosts = (data as ApprovalPost[]) ?? []
        setPosts(nextPosts)
        setDrafts((currentDrafts) => {
          const nextDrafts = { ...currentDrafts }

          for (const post of nextPosts) {
            if (!nextDrafts[post.id]) {
              const { caption } = parseApprovalCaption(post.caption)
              nextDrafts[post.id] = {
                caption,
                imageUrl: post.image_url,
              }
            }
          }

          return nextDrafts
        })
        setLoading(false)
      })
  }, [])

  const filteredPosts = selectedClientId
    ? posts.filter((post) => post.user_id === selectedClientId)
    : posts

  const removedPosts = filteredPosts.filter((post) => parseApprovalCaption(post.caption).meta.changeType === 'removed')
  const revisionPosts = filteredPosts.filter((post) => parseApprovalCaption(post.caption).meta.changeType !== 'removed')

  const removeHandledItem = async (approvalPostId: string) => {
    await supabase.from('approval_posts').delete().eq('id', approvalPostId)
    setPosts((currentPosts) => currentPosts.filter((post) => post.id !== approvalPostId))
  }

  const handleRestoreRemovedPost = async (post: ApprovalPost) => {
    const { caption, meta } = parseApprovalCaption(post.caption)

    if (!meta.sourceScheduledPostId) {
      toast.error('This removed post is missing its calendar reference.')
      return
    }

    const { error } = await supabase
      .from('scheduled_posts')
      .update({ status: 'scheduled' })
      .eq('id', meta.sourceScheduledPostId)
      .eq('user_id', post.user_id)

    if (error) {
      const { error: insertError } = await supabase
        .from('scheduled_posts')
        .insert({
          id: meta.sourceScheduledPostId,
          user_id: post.user_id,
          date: meta.requestedDate || new Date().toISOString().split('T')[0],
          platform: post.platform,
          caption,
          image_url: post.image_url || buildApprovalImagePlaceholder(meta.title || caption),
          status: 'scheduled',
        })

      if (insertError) {
        toast.error('Unable to restore this post to the content calendar.')
        return
      }
    }

    await removeHandledItem(post.id)
    toast.success('Post restored to the client content calendar.')
  }

  const handleConfirmRemoval = async (post: ApprovalPost) => {
    const { meta } = parseApprovalCaption(post.caption)

    if (meta.sourceScheduledPostId) {
      const { error } = await supabase
        .from('scheduled_posts')
        .delete()
        .eq('id', meta.sourceScheduledPostId)
        .eq('user_id', post.user_id)

      if (error) {
        toast.error('Unable to permanently remove this post from the calendar.')
        return
      }
    }

    await removeHandledItem(post.id)
    toast.success('The removal was confirmed and cleared from admin review.')
  }

  const updateDraft = (postId: string, updates: Partial<ChangeDraft>) => {
    setDrafts((currentDrafts) => ({
      ...currentDrafts,
      [postId]: {
        ...currentDrafts[postId],
        ...updates,
      },
    }))
  }

  const handleResubmit = async (post: ApprovalPost) => {
    const draft = drafts[post.id]
    const nextCaption = draft?.caption?.trim()

    if (!nextCaption) {
      toast.error('Please update the caption before resubmitting.')
      return
    }

    updateDraft(post.id, { saving: true })

    const { meta } = parseApprovalCaption(post.caption)
    const encodedCaption = encodeApprovalCaption(nextCaption, meta)
    const imageUrl = draft?.imageUrl?.trim() || buildApprovalImagePlaceholder(meta.title || nextCaption)

    const { error } = await supabase
      .from('approval_posts')
      .update({
        caption: encodedCaption,
        image_url: imageUrl,
        status: 'pending',
        feedback: null,
      })
      .eq('id', post.id)

    updateDraft(post.id, { saving: false })

    if (error) {
      toast.error('Unable to resend this item for approval.')
      return
    }

    setPosts((currentPosts) => currentPosts.filter((currentPost) => currentPost.id !== post.id))
    toast.success('Changes saved and sent back to the approval queue.')
  }

  if (loading) return <p className="text-muted-foreground">Loading requested changes...</p>

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h2 className="text-2xl font-bold">Requested Changes</h2>
        <p className="text-sm text-muted-foreground">
          {selectedClientName
            ? `Review items that need edits for ${selectedClientName}.`
            : 'Select a client above to review requested changes.'}
        </p>
      </div>

      {filteredPosts.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-muted/30 px-4 py-8 text-sm text-muted-foreground">
          No requested changes for this client right now.
        </div>
      ) : (
        <div className="space-y-8">
          <section className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">Requested Changes</h3>
              <p className="text-sm text-muted-foreground">Update these items and send them back through approvals.</p>
            </div>

            {revisionPosts.length === 0 ? (
              <div className="rounded-md border border-dashed border-border bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
                No caption or image revisions are waiting right now.
              </div>
            ) : revisionPosts.map((post) => {
              const { meta } = parseApprovalCaption(post.caption)
              const draft = drafts[post.id] ?? {
                caption: parseApprovalCaption(post.caption).caption,
                imageUrl: post.image_url,
              }

              return (
                <Card key={post.id}>
                  <CardHeader>
                    <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                      <Badge className="bg-yellow-500/20 text-yellow-700 border-yellow-500/50">Changes Requested</Badge>
                      <Badge variant="outline" className="capitalize">{post.platform}</Badge>
                      {post.created_at && <span className="text-sm font-normal text-muted-foreground">{format(new Date(post.created_at), 'PPP')}</span>}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {post.feedback && (
                      <div className="rounded-md border border-border bg-muted/40 p-3">
                        <div className="flex items-start gap-2">
                          <ChatCircle size={16} weight="fill" className="mt-0.5 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">Requested update</p>
                            <p className="text-sm text-muted-foreground">{post.feedback}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label>Updated Caption</Label>
                      <Textarea
                        value={draft.caption}
                        onChange={(event) => updateDraft(post.id, { caption: event.target.value })}
                        className="min-h-[120px]"
                      />
                    </div>

                    <ImageUploadField
                      label="Updated Image"
                      value={draft.imageUrl}
                      onChange={(value) => updateDraft(post.id, { imageUrl: value })}
                      uploadUserId={selectedClientId || post.user_id}
                      helperText={meta.title
                        ? `Upload or paste a revised image for ${meta.title}.`
                        : 'Upload or paste a revised image for this approval item.'}
                    />

                    <Button
                      type="button"
                      onClick={() => handleResubmit(post)}
                      disabled={Boolean(draft.saving)}
                      className="gap-2"
                    >
                      <PaperPlaneTilt size={18} weight="bold" />
                      {draft.saving ? 'Sending...' : 'Send Back to Approval Queue'}
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </section>

          <section className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">Removed from Calendar</h3>
              <p className="text-sm text-muted-foreground">These posts were removed by the client and are waiting for an admin decision.</p>
            </div>

            {removedPosts.length === 0 ? (
              <div className="rounded-md border border-dashed border-border bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
                No removed calendar posts are waiting for review.
              </div>
            ) : removedPosts.map((post) => {
              const { caption } = parseApprovalCaption(post.caption)

              return (
                <Card key={post.id}>
                  <CardHeader>
                    <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                      <Badge className="bg-red-500/15 text-red-700 border-red-500/40">Removed by Client</Badge>
                      <Badge variant="outline" className="capitalize">{post.platform}</Badge>
                      {post.created_at && <span className="text-sm font-normal text-muted-foreground">{format(new Date(post.created_at), 'PPP')}</span>}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="overflow-hidden rounded-md border border-border bg-muted/20">
                      <img src={post.image_url} alt={caption} className="h-56 w-full object-cover" />
                    </div>

                    <p className="text-sm text-muted-foreground whitespace-pre-line">{caption}</p>

                    {post.feedback && (
                      <div className="rounded-md border border-border bg-muted/40 p-3">
                        <div className="flex items-start gap-2">
                          <ChatCircle size={16} weight="fill" className="mt-0.5 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">Removal note</p>
                            <p className="text-sm text-muted-foreground">{post.feedback}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button type="button" onClick={() => handleRestoreRemovedPost(post)} className="gap-2 flex-1">
                        <ArrowCounterClockwise size={18} weight="bold" />
                        Add Back to Calendar
                      </Button>
                      <Button type="button" variant="outline" onClick={() => handleConfirmRemoval(post)} className="gap-2 flex-1 text-destructive hover:text-destructive">
                        <Trash size={18} weight="bold" />
                        Remove Permanently
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </section>
        </div>
      )}
    </div>
  )
}

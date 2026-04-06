import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ContentCalendar } from '@/components/ContentCalendar'
import { supabase } from '@/lib/supabase'
import { buildApprovalImagePlaceholder, parseApprovalCaption } from '@/lib/utils'
import type { ApprovalPost, ScheduledPost, PerformanceMetric } from '@/lib/types'

interface AdminCalendarProps {
  selectedClientId?: string
  selectedClientName?: string
}

export function AdminCalendar({ selectedClientId, selectedClientName }: AdminCalendarProps) {
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([])
  const [approvalPosts, setApprovalPosts] = useState<ApprovalPost[]>([])
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetric[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!selectedClientId) {
      setScheduledPosts([])
      setApprovalPosts([])
      setPerformanceMetrics([])
      return
    }

    const loadData = async () => {
      setLoading(true)
      const [scheduledRes, approvalsRes, metricsRes] = await Promise.all([
        supabase.from('scheduled_posts').select('*').eq('user_id', selectedClientId).eq('status', 'scheduled').order('date', { ascending: true }),
        supabase.from('approval_posts').select('*').eq('user_id', selectedClientId).order('created_at', { ascending: false }),
        supabase.from('performance_metrics').select('*').eq('user_id', selectedClientId).order('date', { ascending: false }),
      ])

      setScheduledPosts((scheduledRes.data as ScheduledPost[]) ?? [])
      setApprovalPosts((approvalsRes.data as ApprovalPost[]) ?? [])
      setPerformanceMetrics((metricsRes.data as PerformanceMetric[]) ?? [])
      setLoading(false)
    }

    loadData()
  }, [selectedClientId])

  const syncRequestStatusFromApproval = async (post: ApprovalPost, approvalStatus: ApprovalPost['status']) => {
    const { meta } = parseApprovalCaption(post.caption)
    if (!meta.sourceRequestId) return

    const nextStatus = approvalStatus === 'approved' ? 'completed' : 'inProgress'
    await supabase
      .from('content_requests')
      .update({ status: nextStatus })
      .eq('id', meta.sourceRequestId)
      .eq('user_id', post.user_id)
  }

  const addApprovedPostToCalendar = async (post: ApprovalPost) => {
    const { caption, meta } = parseApprovalCaption(post.caption)
    const scheduledAt = meta.requestedDate || null
    const scheduledDate = (scheduledAt || new Date().toISOString()).split('T')[0]

    const { data: existingPosts, error: duplicateCheckError } = await supabase
      .from('scheduled_posts')
      .select('*')
      .eq('user_id', post.user_id)
      .eq('date', scheduledDate)
      .eq('platform', post.platform)
      .eq('caption', caption)
      .eq('status', 'scheduled')
      .limit(1)

    if (duplicateCheckError) {
      toast.error('The calendar could not be checked for duplicates.')
      return
    }

    if (existingPosts && existingPosts.length > 0) {
      setScheduledPosts((currentPosts) => {
        const mergedPosts = [...currentPosts]

        for (const existingPost of existingPosts as ScheduledPost[]) {
          if (!mergedPosts.some((currentPost) => currentPost.id === existingPost.id)) {
            mergedPosts.push(existingPost)
          }
        }

        return mergedPosts.sort((a, b) => a.date.localeCompare(b.date))
      })
      return
    }

    const { data, error } = await supabase
      .from('scheduled_posts')
      .insert([{
        user_id: post.user_id,
        date: scheduledDate,
        platform: post.platform,
        caption,
        image_url: post.image_url || buildApprovalImagePlaceholder(meta.title || caption),
        status: 'scheduled',
        scheduled_at: scheduledAt,
        auto_post_enabled: meta.autoPostEnabled ?? true,
        post_type: meta.postType || 'photo',
      }])
      .select()
      .single()

    if (error) {
      toast.error('The item was approved, but it could not be added to the content calendar.')
      return
    }

    if (data) {
      setScheduledPosts((currentPosts) =>
        [...currentPosts, data as ScheduledPost].sort((a, b) => a.date.localeCompare(b.date))
      )
    }
  }

  const handleUpdatePost = async (postId: string, status: ApprovalPost['status'], feedback?: string) => {
    if (!selectedClientId) return

    const targetPost = approvalPosts.find((post) => post.id === postId)
    if (!targetPost) return

    const { error } = await supabase
      .from('approval_posts')
      .update({ status, feedback: feedback || null })
      .eq('id', postId)
      .eq('user_id', selectedClientId)

    if (error) {
      toast.error('Unable to update approval status.')
      return
    }

    setApprovalPosts((currentPosts) =>
      currentPosts.map((post) =>
        post.id === postId
          ? { ...post, status, feedback: feedback || post.feedback }
          : post
      )
    )

    await syncRequestStatusFromApproval(targetPost, status)

    if (status === 'approved') {
      await addApprovedPostToCalendar(targetPost)
    }
  }

  const handleDeleteScheduledPost = async (postId: string) => {
    if (!selectedClientId) return

    const { error } = await supabase
      .from('scheduled_posts')
      .delete()
      .eq('id', postId)
      .eq('user_id', selectedClientId)

    if (error) {
      toast.error('Unable to remove this post from the content calendar.')
      return
    }

    setScheduledPosts((currentPosts) => currentPosts.filter((post) => post.id !== postId))
    toast.success('Post removed from the content calendar.')
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Client Content Calendar</h2>
        <p className="text-sm text-muted-foreground">
          {selectedClientName
            ? `Viewing the content calendar for ${selectedClientName}.`
            : 'Select a client above to open their content calendar.'}
        </p>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading calendar...</p>
      ) : (
        <ContentCalendar
          posts={scheduledPosts}
          approvalPosts={approvalPosts}
          metrics={performanceMetrics}
          onUpdatePost={handleUpdatePost}
          onDeletePost={handleDeleteScheduledPost}
          language="en"
        />
      )}
    </div>
  )
}

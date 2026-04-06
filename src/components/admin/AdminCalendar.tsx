import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ContentCalendar } from '@/components/ContentCalendar'
import { supabase } from '@/lib/supabase'
import { buildApprovalImagePlaceholder, findRelevantMetricForScheduledPost, isScheduledPostPublished, normalizePerformanceMetrics, parseApprovalCaption } from '@/lib/utils'
import { META_WORKER_BASE_URL, fetchPerformanceMetricsForClient, syncFacebookMetricsForClient } from '@/lib/metaMetrics'
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

      let nextMetrics = (metricsRes.data as PerformanceMetric[]) ?? []

      if ((metricsRes.error || nextMetrics.length === 0) && META_WORKER_BASE_URL) {
        try {
          nextMetrics = await fetchPerformanceMetricsForClient(selectedClientId)
        } catch {
          // Keep the calendar usable even if the fallback load fails.
        }
      }

      setScheduledPosts((scheduledRes.data as ScheduledPost[]) ?? [])
      setApprovalPosts((approvalsRes.data as ApprovalPost[]) ?? [])
      setPerformanceMetrics(normalizePerformanceMetrics(nextMetrics))
      setLoading(false)
    }

    void loadData()
  }, [selectedClientId])

  useEffect(() => {
    if (!selectedClientId) {
      return
    }

    const needsMetricSync = scheduledPosts.some((post) =>
      Boolean(post.posted_to_facebook || post.facebook_post_id) &&
      isScheduledPostPublished(post) &&
      !findRelevantMetricForScheduledPost(post, performanceMetrics)
    )

    if (!needsMetricSync) {
      return
    }

    let isCancelled = false

    const syncMissingMetrics = async () => {
      try {
        const result = await syncFacebookMetricsForClient(selectedClientId)

        if (isCancelled || !result || (result.syncedCount ?? 0) === 0) {
          return
        }

        const { data, error } = await supabase
          .from('performance_metrics')
          .select('*')
          .eq('user_id', selectedClientId)
          .order('date', { ascending: false })

        if (isCancelled) {
          return
        }

        const directMetrics = !error ? ((data as PerformanceMetric[]) ?? []) : []

        if (directMetrics.length > 0 || !META_WORKER_BASE_URL) {
          setPerformanceMetrics(normalizePerformanceMetrics(directMetrics))
          return
        }

        const fallbackMetrics = await fetchPerformanceMetricsForClient(selectedClientId)
        if (!isCancelled) {
          setPerformanceMetrics(normalizePerformanceMetrics(fallbackMetrics))
        }
      } catch {
        // Keep auto-sync quiet in the admin calendar.
      }
    }

    void syncMissingMetrics()

    return () => {
      isCancelled = true
    }
  }, [performanceMetrics, scheduledPosts, selectedClientId])

  useEffect(() => {
    if (!selectedClientId) {
      return
    }

    const scheduledPostsChannel = supabase
      .channel(`admin-calendar-posts-${selectedClientId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'scheduled_posts',
          filter: `user_id=eq.${selectedClientId}`,
        },
        async () => {
          const { data, error } = await supabase
            .from('scheduled_posts')
            .select('*')
            .eq('user_id', selectedClientId)
            .eq('status', 'scheduled')
            .order('date', { ascending: true })

          if (!error) {
            setScheduledPosts((data as ScheduledPost[]) ?? [])
          }
        }
      )
      .subscribe()

    const approvalPostsChannel = supabase
      .channel(`admin-calendar-approvals-${selectedClientId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'approval_posts',
          filter: `user_id=eq.${selectedClientId}`,
        },
        async () => {
          const { data, error } = await supabase
            .from('approval_posts')
            .select('*')
            .eq('user_id', selectedClientId)
            .order('created_at', { ascending: false })

          if (!error) {
            setApprovalPosts((data as ApprovalPost[]) ?? [])
          }
        }
      )
      .subscribe()

    const metricsChannel = supabase
      .channel(`admin-calendar-metrics-${selectedClientId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'performance_metrics',
          filter: `user_id=eq.${selectedClientId}`,
        },
        async () => {
          const { data, error } = await supabase
            .from('performance_metrics')
            .select('*')
            .eq('user_id', selectedClientId)
            .order('date', { ascending: false })

          let nextMetrics = !error ? ((data as PerformanceMetric[]) ?? []) : []

          if ((error || nextMetrics.length === 0) && META_WORKER_BASE_URL) {
            try {
              nextMetrics = await fetchPerformanceMetricsForClient(selectedClientId)
            } catch {
              // Keep the last calendar state if the fallback request fails.
            }
          }

          setPerformanceMetrics(normalizePerformanceMetrics(nextMetrics))
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(scheduledPostsChannel)
      void supabase.removeChannel(approvalPostsChannel)
      void supabase.removeChannel(metricsChannel)
    }
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
    const scheduledPayload = {
      date: scheduledDate,
      platform: post.platform,
      caption,
      image_url: post.image_url || buildApprovalImagePlaceholder(meta.title || caption),
      status: 'scheduled' as const,
      scheduled_at: scheduledAt,
      auto_post_enabled: meta.autoPostEnabled ?? true,
      post_type: meta.postType || 'photo',
      post_error: null,
    }

    if (meta.sourceScheduledPostId) {
      const { data: updatedExistingPost, error: updateExistingError } = await supabase
        .from('scheduled_posts')
        .update(scheduledPayload)
        .eq('id', meta.sourceScheduledPostId)
        .eq('user_id', post.user_id)
        .select()
        .single()

      if (!updateExistingError && updatedExistingPost) {
        setScheduledPosts((currentPosts) => {
          const remainingPosts = currentPosts.filter((currentPost) => currentPost.id !== updatedExistingPost.id)
          return [...remainingPosts, updatedExistingPost as ScheduledPost].sort((a, b) => a.date.localeCompare(b.date))
        })
        return
      }
    }

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
        ...scheduledPayload,
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

import { useMemo, useState } from 'react'
import { Calendar as CalendarIcon, Clock, CheckCircle, PencilSimple, ChatCircle, Trash } from '@phosphor-icons/react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { PlatformIcon } from '@/components/PlatformIcon'
import { translations, type Language } from '@/lib/translations'
import type { ScheduledPost, ApprovalPost, PerformanceMetric } from '@/lib/types'
import { findRelevantMetricForScheduledPost, parseApprovalCaption, toMetricNumber } from '@/lib/utils'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { toast } from 'sonner'

interface ContentCalendarProps {
  posts: ScheduledPost[]
  approvalPosts?: ApprovalPost[]
  metrics?: PerformanceMetric[]
  onUpdatePost?: (postId: string, status: ApprovalPost['status'], feedback?: string) => Promise<boolean | void> | boolean | void
  onDeletePost?: (postId: string) => void | Promise<void>
  onRequestEdit?: (scheduledPostId: string, feedback: string) => Promise<boolean | void> | boolean | void
  language: Language
}

type CalendarItem = {
  id: string
  date: string
  platform: ScheduledPost['platform']
  caption: string
  imageUrl: string
  status: 'pending' | 'approved'
  autoPostEnabled?: boolean
  postedToFacebook?: boolean
  postedToInstagram?: boolean
  postedAt?: string | null
  postError?: string | null
  feedback?: string
  approvalId?: string
  scheduledId?: string
  metric?: PerformanceMetric | null
  editPending?: boolean
  editReviewStatus?: ApprovalPost['status'] | null
}

export function ContentCalendar({ posts, approvalPosts = [], metrics = [], onUpdatePost, onDeletePost, onRequestEdit, language }: ContentCalendarProps) {
  const [activeComment, setActiveComment] = useState<string | null>(null)
  const [commentText, setCommentText] = useState('')
  const t = translations[language].calendar
  const performanceT = translations[language].performance

  const calendarItems = useMemo(() => {
    const pendingApprovalItems: CalendarItem[] = approvalPosts
      .filter((post) => {
        const { meta } = parseApprovalCaption(post.caption)
        return meta.requestedBy !== 'client' && post.status === 'pending'
      })
      .map((post) => {
        const { caption, meta } = parseApprovalCaption(post.caption)
        return {
          id: `approval-${post.id}`,
          approvalId: post.id,
          date: meta.requestedDate || post.created_at || new Date().toISOString(),
          platform: post.platform,
          caption,
          imageUrl: post.image_url,
          status: 'pending' as const,
          feedback: post.feedback,
        }
      })

    const approvedItems: CalendarItem[] = posts
      .filter((post) => post.status === 'scheduled')
      .map((post) => {
        const linkedEditRequest = approvalPosts.find((approvalPost) => {
          const { meta } = parseApprovalCaption(approvalPost.caption)
          return meta.sourceScheduledPostId === post.id && meta.changeType === 'revision' && approvalPost.status !== 'approved'
        })

        return {
          id: `scheduled-${post.id}`,
          scheduledId: post.id,
          date: post.scheduled_at || post.date,
          platform: post.platform,
          caption: post.caption,
          imageUrl: post.image_url,
          status: 'approved' as const,
          autoPostEnabled: post.auto_post_enabled ?? true,
          postedToFacebook: post.posted_to_facebook ?? false,
          postedToInstagram: post.posted_to_instagram ?? false,
          postedAt: post.posted_at,
          postError: post.post_error,
          feedback: linkedEditRequest?.feedback,
          editPending: Boolean(linkedEditRequest),
          editReviewStatus: linkedEditRequest?.status ?? null,
          metric: findRelevantMetricForScheduledPost(post, metrics),
        }
      })

    return [...pendingApprovalItems, ...approvedItems].sort((a, b) => a.date.localeCompare(b.date))
  }, [approvalPosts, metrics, posts])

  const handleApprove = async (approvalId?: string) => {
    if (!approvalId || !onUpdatePost) return
    await onUpdatePost(approvalId, 'approved')
  }

  const handleRequestChanges = async (approvalId?: string) => {
    if (!approvalId || !onUpdatePost) return

    const commentKey = `approval:${approvalId}`

    if (activeComment === commentKey) {
      await onUpdatePost(approvalId, 'changes-requested', commentText)
      setActiveComment(null)
      setCommentText('')
      return
    }

    setActiveComment(commentKey)
  }

  const handleRequestEdit = async (scheduledId?: string) => {
    if (!scheduledId || !onRequestEdit) return

    const commentKey = `scheduled:${scheduledId}`

    if (activeComment === commentKey) {
      const feedback = commentText.trim()

      if (!feedback) {
        toast.error(language === 'en' ? 'Please add the requested edit first.' : 'Primero agrega la edición solicitada.')
        return
      }

      const updated = await onRequestEdit(scheduledId, feedback)
      if (updated !== false) {
        setActiveComment(null)
        setCommentText('')
      }
      return
    }

    setActiveComment(commentKey)
  }

  const handleRemove = async (scheduledId?: string) => {
    if (!scheduledId || !onDeletePost) return

    const confirmed = window.confirm(
      language === 'en'
        ? 'Remove this post from the content calendar?'
        : '¿Quitar esta publicación del calendario de contenido?'
    )

    if (!confirmed) return
    await onDeletePost(scheduledId)
  }

  if (calendarItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <CalendarIcon size={64} weight="thin" className="text-muted-foreground mb-4" />
        <p className="text-muted-foreground text-lg">{t.empty}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold tracking-tight">{t.title}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {calendarItems.map((item) => (
          <Card
            key={item.id}
            className="overflow-hidden hover:border-primary/50 transition-all duration-200 hover:shadow-lg hover:shadow-primary/5"
          >
            <div className="aspect-square bg-secondary/50 relative overflow-hidden">
              <img
                src={item.imageUrl}
                alt={item.caption}
                className="w-full h-full object-cover"
                loading="lazy"
                decoding="async"
              />
            </div>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <PlatformIcon platform={item.platform} size={20} className="text-primary" />
                  <Badge variant="outline" className="capitalize">
                    {item.platform}
                  </Badge>
                </div>
                <Badge
                  className={item.status === 'pending'
                    ? 'bg-yellow-500/20 text-yellow-700 border-yellow-500/50'
                    : 'bg-green-500/20 text-green-700 border-green-500/50'}
                >
                  <Clock size={14} weight="bold" />
                  {item.status === 'pending'
                    ? (language === 'en' ? 'Pending Approval' : 'Pendiente de aprobación')
                    : (language === 'en' ? 'Approved' : 'Aprobado')}
                </Badge>
              </div>

              {item.status === 'approved' && (
                <div className="flex flex-wrap gap-2">
                  {item.postedToFacebook && (
                    <Badge variant="outline" className="border-emerald-500/50 text-emerald-600">
                      FB Posted
                    </Badge>
                  )}
                  {item.postedToInstagram && (
                    <Badge variant="outline" className="border-emerald-500/50 text-emerald-600">
                      IG Posted
                    </Badge>
                  )}
                  {item.editPending && (
                    <Badge variant="outline" className="border-amber-500/50 text-amber-700">
                      {item.editReviewStatus === 'pending' ? t.awaitingReview : t.editRequested}
                    </Badge>
                  )}
                  {item.postError && (
                    <Badge variant="outline" className="border-destructive/50 text-destructive">
                      {language === 'en' ? 'Post Failed' : 'Error al publicar'}
                    </Badge>
                  )}
                  {!item.postedToFacebook && !item.postedToInstagram && !item.postError && !item.editPending && item.autoPostEnabled && (
                    <Badge variant="outline" className="border-amber-500/50 text-amber-700">
                      {language === 'en' ? 'Pending Auto-Post' : 'Pendiente de publicación'}
                    </Badge>
                  )}
                </div>
              )}

              <p className="text-sm text-muted-foreground line-clamp-3 whitespace-pre-line">
                {item.caption}
              </p>

              {item.status === 'approved' && item.metric && (
                <div className="grid grid-cols-3 gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{performanceT.reach}</p>
                    <p className="text-sm font-semibold text-foreground">{toMetricNumber(item.metric.reach).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{performanceT.likes}</p>
                    <p className="text-sm font-semibold text-foreground">{toMetricNumber(item.metric.likes).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{performanceT.engagement}</p>
                    <p className="text-sm font-semibold text-foreground">{toMetricNumber(item.metric.engagement_rate).toFixed(1)}%</p>
                  </div>
                </div>
              )}

              {item.status === 'approved' && !item.metric && (item.postedToFacebook || item.postedToInstagram) && (
                <Badge variant="outline" className="border-sky-500/50 text-sky-700">
                  {language === 'en' ? 'Metrics syncing' : 'Sincronizando métricas'}
                </Badge>
              )}

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarIcon size={16} weight="bold" />
                <time>
                  {t.scheduled}{' '}
                  {format(new Date(item.date), String(item.date).includes('T') ? 'PPP p' : 'PPP', {
                    locale: language === 'es' ? es : undefined,
                  })}
                </time>
              </div>

              {item.feedback && (
                <div className="bg-muted/50 p-3 rounded-md border border-border">
                  <div className="flex items-start gap-2">
                    <ChatCircle size={16} weight="fill" className="text-muted-foreground mt-0.5" />
                    <p className="text-sm text-muted-foreground">{item.feedback}</p>
                  </div>
                </div>
              )}

              {item.status === 'pending' && item.approvalId && (
                <>
                  {activeComment === `approval:${item.approvalId}` && (
                    <Textarea
                      placeholder={language === 'en' ? 'Add requested changes' : 'Agrega los cambios solicitados'}
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      className="min-h-[100px]"
                    />
                  )}

                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleApprove(item.approvalId)}
                      className="flex-1 gap-2"
                      size="sm"
                    >
                      <CheckCircle size={18} weight="bold" />
                      {language === 'en' ? 'Approve' : 'Aprobar'}
                    </Button>
                    <Button
                      onClick={() => handleRequestChanges(item.approvalId)}
                      variant="outline"
                      className="flex-1 gap-2"
                      size="sm"
                    >
                      <PencilSimple size={18} weight="bold" />
                      {activeComment === `approval:${item.approvalId}`
                        ? (language === 'en' ? 'Send' : 'Enviar')
                        : (language === 'en' ? 'Request Change' : 'Solicitar cambio')}
                    </Button>
                  </div>
                </>
              )}

              {item.status === 'approved' && item.scheduledId && onRequestEdit && !item.postedToFacebook && !item.postedToInstagram && !item.postedAt && (
                <>
                  {activeComment === `scheduled:${item.scheduledId}` && (
                    <Textarea
                      placeholder={t.editComment}
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      className="min-h-[100px]"
                    />
                  )}

                  <Button
                    onClick={() => handleRequestEdit(item.scheduledId)}
                    variant="outline"
                    className="w-full gap-2"
                    size="sm"
                  >
                    <PencilSimple size={18} weight="bold" />
                    {activeComment === `scheduled:${item.scheduledId}` ? t.sendEdit : t.requestEdit}
                  </Button>
                </>
              )}

              {item.status === 'approved' && item.scheduledId && onDeletePost && (
                <Button
                  onClick={() => handleRemove(item.scheduledId)}
                  variant="outline"
                  className="w-full gap-2 text-destructive hover:text-destructive"
                  size="sm"
                >
                  <Trash size={18} weight="bold" />
                  {language === 'en' ? 'Remove from Calendar' : 'Quitar del calendario'}
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

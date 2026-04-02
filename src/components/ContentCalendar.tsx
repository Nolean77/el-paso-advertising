import { useState } from 'react'
import { Calendar as CalendarIcon, Clock, CheckCircle, PencilSimple, ChatCircle } from '@phosphor-icons/react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { PlatformIcon } from '@/components/PlatformIcon'
import { translations, type Language } from '@/lib/translations'
import type { ScheduledPost, ApprovalPost } from '@/lib/types'
import { parseApprovalCaption } from '@/lib/utils'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface ContentCalendarProps {
  posts: ScheduledPost[]
  approvalPosts?: ApprovalPost[]
  onUpdatePost?: (postId: string, status: ApprovalPost['status'], feedback?: string) => void | Promise<void>
  language: Language
}

type CalendarItem = {
  id: string
  date: string
  platform: ScheduledPost['platform']
  caption: string
  imageUrl: string
  status: 'pending' | 'approved'
  feedback?: string
  approvalId?: string
}

export function ContentCalendar({ posts, approvalPosts = [], onUpdatePost, language }: ContentCalendarProps) {
  const [activeComment, setActiveComment] = useState<string | null>(null)
  const [commentText, setCommentText] = useState('')
  const t = translations[language].calendar

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

  const approvedItems: CalendarItem[] = posts.map((post) => ({
    id: `scheduled-${post.id}`,
    date: post.date,
    platform: post.platform,
    caption: post.caption,
    imageUrl: post.image_url,
    status: 'approved' as const,
  }))

  const calendarItems = [...pendingApprovalItems, ...approvedItems].sort((a, b) => a.date.localeCompare(b.date))

  const handleApprove = async (approvalId?: string) => {
    if (!approvalId || !onUpdatePost) return
    await onUpdatePost(approvalId, 'approved')
  }

  const handleRequestChanges = async (approvalId?: string) => {
    if (!approvalId || !onUpdatePost) return

    if (activeComment === approvalId) {
      await onUpdatePost(approvalId, 'changes-requested', commentText)
      setActiveComment(null)
      setCommentText('')
      return
    }

    setActiveComment(approvalId)
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

              <p className="text-sm text-muted-foreground line-clamp-3 whitespace-pre-line">
                {item.caption}
              </p>

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarIcon size={16} weight="bold" />
                <time>
                  {format(new Date(item.date), 'PPP', {
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
                  {activeComment === item.approvalId && (
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
                      {activeComment === item.approvalId
                        ? (language === 'en' ? 'Send' : 'Enviar')
                        : (language === 'en' ? 'Request Change' : 'Solicitar cambio')}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

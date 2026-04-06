import { useState } from 'react'
import { CheckCircle, PencilSimple, ChatCircle } from '@phosphor-icons/react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { PlatformIcon } from '@/components/PlatformIcon'
import { translations, type Language } from '@/lib/translations'
import type { ApprovalPost } from '@/lib/types'
import { parseApprovalCaption } from '@/lib/utils'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'

interface ApprovalsProps {
  posts: ApprovalPost[]
  onUpdatePost: (postId: string, status: ApprovalPost['status'], feedback?: string) => void
  language: Language
}

export function Approvals({ posts, onUpdatePost, language }: ApprovalsProps) {
  const [activeComment, setActiveComment] = useState<string | null>(null)
  const [commentText, setCommentText] = useState('')

  const t = translations[language].approvals

  const handleApprove = (postId: string) => {
    onUpdatePost(postId, 'approved')
    toast.success(language === 'en' ? 'Post approved!' : '¡Publicación aprobada!')
  }

  const handleRequestChanges = (postId: string) => {
    if (activeComment === postId) {
      onUpdatePost(postId, 'changes-requested', commentText)
      setActiveComment(null)
      setCommentText('')
      toast.success(language === 'en' ? 'Feedback submitted!' : '¡Comentarios enviados!')
    } else {
      setActiveComment(postId)
    }
  }

  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <CheckCircle size={64} weight="thin" className="text-muted-foreground mb-4" />
        <p className="text-muted-foreground text-lg">{t.empty}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold tracking-tight">{t.title}</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {posts.map((post) => {
          const { caption, meta } = parseApprovalCaption(post.caption)
          const isAwaitingAdminReview = meta.requestedBy === 'client'

          return (
            <motion.div
              key={post.id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
            >
              <Card className="overflow-hidden">
                <div className="aspect-square bg-secondary/50 relative overflow-hidden">
                  <img 
                    src={post.image_url} 
                    alt={caption}
                    className="w-full h-full object-cover"
                  />
                  {post.status !== 'pending' && (
                    <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center">
                      <Badge 
                        variant={post.status === 'approved' ? 'default' : 'secondary'}
                        className="text-base px-4 py-2"
                      >
                        {post.status === 'approved' ? t.approved : t.changesRequested}
                      </Badge>
                    </div>
                  )}
                </div>
                <CardContent className="p-4 space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <PlatformIcon platform={post.platform} size={20} className="text-primary" />
                      <Badge variant="outline" className="capitalize">
                        {post.platform}
                      </Badge>
                    </div>
                    {post.status === 'pending' && isAwaitingAdminReview && (
                      <Badge variant="secondary">
                        {language === 'en' ? 'Awaiting Admin Review' : 'Esperando revisión del administrador'}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">
                    {caption}
                  </p>
                  
                  {post.feedback && (
                    <div className="bg-muted/50 p-3 rounded-md border border-border">
                      <div className="flex items-start gap-2">
                        <ChatCircle size={16} weight="fill" className="text-muted-foreground mt-0.5" />
                        <p className="text-sm text-muted-foreground">{post.feedback}</p>
                      </div>
                    </div>
                  )}

                  <AnimatePresence>
                    {activeComment === post.id && post.status === 'pending' && !isAwaitingAdminReview && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <Textarea
                          placeholder={t.comment}
                          value={commentText}
                          onChange={(e) => setCommentText(e.target.value)}
                          className="min-h-[100px]"
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {post.status === 'pending' && !isAwaitingAdminReview && (
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleApprove(post.id)}
                        className="flex-1 gap-2"
                        size="lg"
                      >
                        <CheckCircle size={20} weight="bold" />
                        {t.approve}
                      </Button>
                      <Button
                        onClick={() => handleRequestChanges(post.id)}
                        variant="outline"
                        className="flex-1 gap-2 hover:border-primary"
                        size="lg"
                      >
                        <PencilSimple size={20} weight="bold" />
                        {activeComment === post.id ? t.submit : t.requestChanges}
                      </Button>
                    </div>
                  )}

                  {post.status === 'pending' && isAwaitingAdminReview && (
                    <div className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                      {language === 'en'
                        ? 'This request is in the admin approval queue and will move to your calendar once it is approved.'
                        : 'Esta solicitud está en la cola de aprobación del administrador y pasará a tu calendario una vez aprobada.'}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

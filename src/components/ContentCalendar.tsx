import { Calendar as CalendarIcon, Clock } from '@phosphor-icons/react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PlatformIcon } from '@/components/PlatformIcon'
import { translations, type Language } from '@/lib/translations'
import type { ScheduledPost } from '@/lib/types'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface ContentCalendarProps {
  posts: ScheduledPost[]
  language: Language
}

export function ContentCalendar({ posts, language }: ContentCalendarProps) {
  const t = translations[language].calendar

  if (posts.length === 0) {
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
        {posts.map((post) => (
          <Card 
            key={post.id} 
            className="overflow-hidden hover:border-primary/50 transition-all duration-200 hover:shadow-lg hover:shadow-primary/5"
          >
            <div className="aspect-square bg-secondary/50 relative overflow-hidden">
              <img 
                src={post.image_url} 
                alt={post.caption}
                className="w-full h-full object-cover"
              />
            </div>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PlatformIcon platform={post.platform} size={20} className="text-primary" />
                  <Badge variant="outline" className="capitalize">
                    {post.platform}
                  </Badge>
                </div>
                <Badge variant="secondary" className="gap-1">
                  <Clock size={14} weight="bold" />
                  {t.scheduled}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2">
                {post.caption}
              </p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarIcon size={16} weight="bold" />
                <time>
                  {format(new Date(post.date), 'PPP', { 
                    locale: language === 'es' ? es : undefined 
                  })}
                </time>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

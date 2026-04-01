import { useState } from 'react'
import { Plus, Article } from '@phosphor-icons/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { translations, type Language } from '@/lib/translations'
import type { ContentRequest } from '@/lib/types'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface RequestsProps {
  requests: ContentRequest[]
  onSubmitRequest: (request: Omit<ContentRequest, 'id' | 'createdAt' | 'status'>) => void
  language: Language
}

export function Requests({ requests, onSubmitRequest, language }: RequestsProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<ContentRequest['type']>('content')

  const t = translations[language].requests

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!title.trim() || !description.trim()) {
      return
    }

    onSubmitRequest({
      title,
      description,
      type,
    })

    setTitle('')
    setDescription('')
    setType('content')
    
    toast.success(t.success)
  }

  const getStatusColor = (status: ContentRequest['status']) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-500/20 text-yellow-500 border-yellow-500/50'
      case 'inProgress':
        return 'bg-blue-500/20 text-blue-500 border-blue-500/50'
      case 'completed':
        return 'bg-green-500/20 text-green-500 border-green-500/50'
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus size={24} weight="bold" className="text-primary" />
            {t.title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="request-title">{t.requestTitle}</Label>
              <Input
                id="request-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={language === 'en' ? 'e.g., Holiday campaign graphics' : 'ej., Gráficos para campaña navideña'}
                required
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="request-description">{t.description}</Label>
              <Textarea
                id="request-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={language === 'en' 
                  ? 'Describe your request in detail...' 
                  : 'Describe tu solicitud en detalle...'
                }
                required
                className="min-h-[120px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="request-type">{t.type}</Label>
              <Select value={type} onValueChange={(v) => setType(v as ContentRequest['type'])}>
                <SelectTrigger id="request-type" className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="content">{t.types.content}</SelectItem>
                  <SelectItem value="design">{t.types.design}</SelectItem>
                  <SelectItem value="campaign">{t.types.campaign}</SelectItem>
                  <SelectItem value="other">{t.types.other}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" className="w-full h-11 text-base font-semibold" size="lg">
              <Plus size={20} weight="bold" />
              {t.submit}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h3 className="text-xl font-semibold tracking-tight">{t.tracker}</h3>
        
        {requests.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Article size={64} weight="thin" className="text-muted-foreground mb-4" />
              <p className="text-muted-foreground">{t.empty}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {requests.map((request) => (
              <Card key={request.id} className="hover:border-primary/50 transition-colors">
                <CardContent className="p-4">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div className="flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-semibold text-foreground">{request.title}</h4>
                        <Badge variant="outline" className="capitalize">
                          {t.types[request.type]}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {request.description}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(request.createdAt), 'PPP', { 
                          locale: language === 'es' ? es : undefined 
                        })}
                      </p>
                    </div>
                    <Badge className={getStatusColor(request.status)}>
                      {t.status[request.status]}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

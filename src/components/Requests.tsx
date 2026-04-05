import { useState, useRef } from 'react'
import { Plus, Article, Image as ImageIcon, X, Upload, Warning } from '@phosphor-icons/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { translations, type Language } from '@/lib/translations'
import type { ContentRequest, RequestSubmission } from '@/lib/types'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { compressImage, formatFileSize, FILE_SIZE_LIMITS } from '@/lib/imageCompression'
import { uploadImageFile } from '@/lib/uploadImage'

interface RequestsProps {
  requests: ContentRequest[]
  onSubmitRequest: (request: RequestSubmission) => Promise<void> | void
  userId: string
  language: Language
}

export function Requests({ requests, onSubmitRequest, userId, language }: RequestsProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<ContentRequest['type']>('content')
  const [platform, setPlatform] = useState<RequestSubmission['platform']>('instagram')
  const [requestedDate, setRequestedDate] = useState(() => new Date().toISOString().split('T')[0])
  const [referenceImages, setReferenceImages] = useState<string[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const t = translations[language].requests

  const handleFileChange = async (files: FileList | null) => {
    if (!files) return

    const maxImages = 5
    if (referenceImages.length + files.length > maxImages) {
      toast.error(t.maxImages)
      return
    }

    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) {
        toast.error(t.invalidFileType)
        continue
      }

      if (file.size > FILE_SIZE_LIMITS.max) {
        toast.error(t.fileTooLarge)
        continue
      }

      if (file.size > FILE_SIZE_LIMITS.warning) {
        toast.info(t.compressionWarning.replace('{size}', formatFileSize(file.size)))
        
        try {
          const compressed = await compressImage(file)
          const publicUrl = await uploadImageFile(compressed.file, userId, file.name, 'post-images')
          if (!publicUrl) {
            toast.error(language === 'en' ? 'Failed to upload image' : 'Error al subir la imagen')
            continue
          }

          setReferenceImages((prev) => [...prev, publicUrl])
          
          toast.success(
            t.compressionSuccess
              .replace('{original}', formatFileSize(compressed.originalSize))
              .replace('{compressed}', formatFileSize(compressed.compressedSize))
              .replace('{ratio}', compressed.compressionRatio.toFixed(0))
          )
        } catch {
          toast.error(language === 'en' ? 'Failed to process image' : 'Error al procesar la imagen')
        }
      } else {
        try {
          const publicUrl = await uploadImageFile(file, userId, file.name, 'post-images')
          if (!publicUrl) {
            toast.error(language === 'en' ? 'Failed to upload image' : 'Error al subir la imagen')
            continue
          }

          setReferenceImages((prev) => [...prev, publicUrl])
        } catch {
          toast.error(language === 'en' ? 'Failed to upload image' : 'Error al subir la imagen')
        }
      }
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    handleFileChange(e.dataTransfer.files)
  }

  const removeImage = (index: number) => {
    setReferenceImages((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!title.trim() || !description.trim()) {
      return
    }

    onSubmitRequest({
      title,
      description,
      type,
      platform,
      requested_date: requestedDate || undefined,
      reference_images: referenceImages.length > 0 ? referenceImages : undefined,
    })

    setTitle('')
    setDescription('')
    setType('content')
    setPlatform('instagram')
    setRequestedDate(new Date().toISOString().split('T')[0])
    setReferenceImages([])
    
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="request-platform">
                  {language === 'en' ? 'Preferred Platform' : 'Plataforma Preferida'}
                </Label>
                <Select value={platform} onValueChange={(v) => setPlatform(v as RequestSubmission['platform'])}>
                  <SelectTrigger id="request-platform" className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="instagram">Instagram</SelectItem>
                    <SelectItem value="facebook">Facebook</SelectItem>
                    <SelectItem value="twitter">Twitter / X</SelectItem>
                    <SelectItem value="linkedin">LinkedIn</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="request-date">
                  {language === 'en' ? 'Preferred Publish Date' : 'Fecha Preferida de Publicación'}
                </Label>
                <Input
                  id="request-date"
                  type="date"
                  value={requestedDate}
                  onChange={(e) => setRequestedDate(e.target.value)}
                  className="h-11"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t.referenceImages} ({language === 'en' ? 'Optional' : 'Opcional'})</Label>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`
                  border-2 border-dashed rounded-lg p-6 transition-all cursor-pointer
                  ${isDragging 
                    ? 'border-primary bg-primary/10' 
                    : 'border-border hover:border-primary/50 hover:bg-muted/50'
                  }
                `}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="flex flex-col items-center justify-center gap-3 text-center">
                  <div className="p-3 rounded-full bg-primary/20">
                    <Upload size={32} weight="bold" className="text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{t.dropzone}</p>
                    <p className="text-xs text-muted-foreground mt-1">{t.maxImages}</p>
                    <div className="flex items-center justify-center gap-1 mt-2 text-xs text-muted-foreground">
                      <Warning size={14} weight="bold" className="text-yellow-500" />
                      <span>
                        {language === 'en' 
                          ? `Max 10MB per file • Auto-compression over 5MB` 
                          : `Máx 10MB por archivo • Auto-compresión sobre 5MB`}
                      </span>
                    </div>
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => handleFileChange(e.target.files)}
                />
              </div>

              {referenceImages.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mt-3">
                  {referenceImages.map((image, index) => (
                    <div key={index} className="relative group aspect-square">
                      <img
                        src={image}
                        alt={`Reference ${index + 1}`}
                        className="w-full h-full object-cover rounded-lg border border-border"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          removeImage(index)
                        }}
                        className="absolute -top-2 -right-2 p-1 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:scale-110"
                      >
                        <X size={16} weight="bold" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
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
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
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
                          {format(new Date(request.created_at), 'PPP', { 
                            locale: language === 'es' ? es : undefined 
                          })}
                        </p>
                      </div>
                      <Badge className={getStatusColor(request.status)}>
                        {t.status[request.status]}
                      </Badge>
                    </div>

                    {request.reference_images && request.reference_images.length > 0 && (
                      <>
                        <Separator />
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <ImageIcon size={16} weight="bold" />
                            <span>{request.reference_images.length} {t.images}</span>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                            {request.reference_images.map((image, index) => (
                              <div key={index} className="aspect-square">
                                <img
                                  src={image}
                                  alt={`${request.title} reference ${index + 1}`}
                                  className="w-full h-full object-cover rounded border border-border hover:scale-105 transition-transform cursor-pointer"
                                  onClick={() => window.open(image, '_blank')}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
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

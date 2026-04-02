import { useRef, useState } from 'react'
import { Image as ImageIcon, Upload, Warning, X } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { compressImage, FILE_SIZE_LIMITS, formatFileSize } from '@/lib/imageCompression'

interface ImageUploadFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  helperText?: string
  urlPlaceholder?: string
}

export function ImageUploadField({
  label,
  value,
  onChange,
  helperText = 'Drag and drop an image here, click to upload, or paste an image URL below.',
  urlPlaceholder = 'https://...',
}: ImageUploadFieldProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const handleFileSelection = async (files: FileList | null) => {
    const file = files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file only.')
      return
    }

    if (file.size > FILE_SIZE_LIMITS.max) {
      toast.error('That image is too large. Please use a file smaller than 10MB.')
      return
    }

    try {
      if (file.size > FILE_SIZE_LIMITS.warning) {
        toast.info(`Compressing image from ${formatFileSize(file.size)}...`)
        const compressed = await compressImage(file)
        onChange(compressed.dataUrl)
        toast.success(`Image compressed to ${formatFileSize(compressed.compressedSize)} and attached.`)
        return
      }

      const reader = new FileReader()
      reader.onload = (event) => {
        const result = event.target?.result as string
        if (result) {
          onChange(result)
          toast.success('Image attached successfully.')
        }
      }
      reader.readAsDataURL(file)
    } catch {
      toast.error('Unable to process that image right now.')
    }
  }

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
    handleFileSelection(event.dataTransfer.files)
  }

  const manualUrlValue = value.startsWith('data:') ? '' : value

  return (
    <div className="space-y-3">
      <Label>{label}</Label>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={[
          'cursor-pointer rounded-lg border-2 border-dashed p-4 transition-colors',
          isDragging ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50 hover:bg-muted/40',
        ].join(' ')}
      >
        {value ? (
          <div className="space-y-3">
            <img
              src={value}
              alt="Selected upload"
              className="h-48 w-full rounded-md object-cover border border-border"
            />
            <p className="text-sm text-muted-foreground">
              Drop a new image here or click to replace the current one.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
            <div className="rounded-full bg-primary/15 p-3">
              <Upload size={24} weight="bold" className="text-primary" />
            </div>
            <p className="text-sm font-medium">Drag & drop an image here</p>
            <p className="text-xs text-muted-foreground">or click to choose one from your device</p>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Warning size={14} weight="bold" className="text-yellow-500" />
              <span>Max 10MB • Large images will be compressed automatically</span>
            </div>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => handleFileSelection(event.target.files)}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} className="gap-2">
          <Upload size={16} weight="bold" />
          Upload Image
        </Button>

        {value && (
          <Button type="button" variant="ghost" onClick={() => onChange('')} className="gap-2">
            <X size={16} weight="bold" />
            Remove Image
          </Button>
        )}
      </div>

      <div className="space-y-2">
        <Label>Or paste an image URL</Label>
        <div className="relative">
          <ImageIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={manualUrlValue}
            onChange={(event) => onChange(event.target.value)}
            placeholder={urlPlaceholder}
            className="pl-9"
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">{helperText}</p>
    </div>
  )
}

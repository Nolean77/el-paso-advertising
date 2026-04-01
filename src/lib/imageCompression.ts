export interface CompressionOptions {
  maxSizeMB: number
  maxWidthOrHeight: number
  quality: number
}

const DEFAULT_OPTIONS: CompressionOptions = {
  maxSizeMB: 2,
  maxWidthOrHeight: 1920,
  quality: 0.8,
}

export const FILE_SIZE_LIMITS = {
  warning: 5 * 1024 * 1024,
  max: 10 * 1024 * 1024,
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

export async function compressImage(
  file: File,
  options: Partial<CompressionOptions> = {}
): Promise<{ file: Blob; dataUrl: string; originalSize: number; compressedSize: number; compressionRatio: number }> {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  return new Promise((resolve, reject) => {
    const img = new Image()
    const reader = new FileReader()

    reader.onload = (e) => {
      const dataUrl = e.target?.result as string
      img.src = dataUrl

      img.onload = () => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')

        if (!ctx) {
          reject(new Error('Canvas context not available'))
          return
        }

        let { width, height } = img

        if (width > opts.maxWidthOrHeight || height > opts.maxWidthOrHeight) {
          if (width > height) {
            height = (height / width) * opts.maxWidthOrHeight
            width = opts.maxWidthOrHeight
          } else {
            width = (width / height) * opts.maxWidthOrHeight
            height = opts.maxWidthOrHeight
          }
        }

        canvas.width = width
        canvas.height = height

        ctx.fillStyle = '#FFFFFF'
        ctx.fillRect(0, 0, width, height)
        ctx.drawImage(img, 0, 0, width, height)

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Compression failed'))
              return
            }

            const originalSize = file.size
            const compressedSize = blob.size

            if (compressedSize > opts.maxSizeMB * 1024 * 1024) {
              const newQuality = Math.max(0.5, opts.quality - 0.1)
              if (newQuality < opts.quality) {
                compressImage(file, { ...opts, quality: newQuality })
                  .then(resolve)
                  .catch(reject)
                return
              }
            }

            const reader2 = new FileReader()
            reader2.onload = (e2) => {
              resolve({
                file: blob,
                dataUrl: e2.target?.result as string,
                originalSize,
                compressedSize,
                compressionRatio: originalSize > 0 ? (1 - compressedSize / originalSize) * 100 : 0,
              })
            }
            reader2.onerror = reject
            reader2.readAsDataURL(blob)
          },
          file.type || 'image/jpeg',
          opts.quality
        )
      }

      img.onerror = () => reject(new Error('Failed to load image'))
    }

    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

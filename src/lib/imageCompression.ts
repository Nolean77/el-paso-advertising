export const FILE_SIZE_LIMITS = {
  warning: 5 * 1024 * 1024,
  max: 10 * 1024 * 1024,
}

export interface CompressionResult {
  file: Blob
  originalSize: number
  compressedSize: number
  compressionRatio: number
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

async function loadImageBitmap(file: File): Promise<ImageBitmap> {
  return createImageBitmap(file)
}

async function compressAtQuality(
  image: ImageBitmap,
  mimeType: string,
  maxWidthOrHeight: number,
  quality: number
): Promise<Blob> {
  let { width, height } = image

  if (width > maxWidthOrHeight || height > maxWidthOrHeight) {
    if (width > height) {
      height = Math.round((height / width) * maxWidthOrHeight)
      width = maxWidthOrHeight
    } else {
      width = Math.round((width / height) * maxWidthOrHeight)
      height = maxWidthOrHeight
    }
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Canvas context not available')
  }

  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(image, 0, 0, width, height)

  const output = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, mimeType, quality)
  })

  if (!output) {
    throw new Error('Compression failed')
  }

  return output
}

export async function compressImage(file: File): Promise<CompressionResult> {
  const maxSizeBytes = 2 * 1024 * 1024
  const maxWidthOrHeight = 1920
  const mimeType = file.type || 'image/jpeg'
  const originalSize = file.size

  const image = await loadImageBitmap(file)

  try {
    let quality = 0.85
    let compressed = await compressAtQuality(image, mimeType, maxWidthOrHeight, quality)

    while (compressed.size > maxSizeBytes && quality > 0.5) {
      quality = Math.max(0.5, quality - 0.1)
      compressed = await compressAtQuality(image, mimeType, maxWidthOrHeight, quality)
    }

    return {
      file: compressed,
      originalSize,
      compressedSize: compressed.size,
      compressionRatio: originalSize > 0 ? (1 - compressed.size / originalSize) * 100 : 0,
    }
  } finally {
    image.close()
  }
}

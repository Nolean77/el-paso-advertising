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

type LoadedImage = {
  width: number
  height: number
  drawTo: (ctx: CanvasRenderingContext2D, width: number, height: number) => void
  cleanup: () => void
}

async function loadImageBitmap(file: File): Promise<LoadedImage> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file)
    return {
      width: bitmap.width,
      height: bitmap.height,
      drawTo: (ctx, width, height) => ctx.drawImage(bitmap, 0, 0, width, height),
      cleanup: () => bitmap.close(),
    }
  }

  const objectUrl = URL.createObjectURL(file)
  try {
    const imageElement = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error('Failed to load image'))
      image.src = objectUrl
    })

    return {
      width: imageElement.naturalWidth || imageElement.width,
      height: imageElement.naturalHeight || imageElement.height,
      drawTo: (ctx, width, height) => ctx.drawImage(imageElement, 0, 0, width, height),
      cleanup: () => URL.revokeObjectURL(objectUrl),
    }
  } catch (error) {
    URL.revokeObjectURL(objectUrl)
    throw error
  }
}

async function compressAtQuality(
  image: LoadedImage,
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
  image.drawTo(ctx, width, height)

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
    image.cleanup()
  }
}

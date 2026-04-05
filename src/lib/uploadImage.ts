import { supabase } from './supabase'

function getFileExtension(contentType: string | undefined, fileName?: string): string {
  const fromName = fileName?.split('.').pop()?.toLowerCase()
  if (fromName && /^[a-z0-9]+$/.test(fromName)) {
    return fromName
  }

  if (!contentType) return 'jpg'
  if (contentType.includes('png')) return 'png'
  if (contentType.includes('webp')) return 'webp'
  if (contentType.includes('gif')) return 'gif'
  if (contentType.includes('heic')) return 'heic'
  return 'jpg'
}

export async function uploadImageFile(
  file: Blob,
  userId: string,
  fileName,
  bucket = 'post-images'
): Promise<string | null> {
  try {
    const mimeType = file.type || 'image/jpeg'
    const fileExt = getFileExtension(file.type, fileName)
    const timestamp = Date.now()
    const filePath = `${userId}/${timestamp}.${fileExt}`

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        contentType: mimeType,
        upsert: false,
      })

    if (error) {
      console.error('Upload error:', error)
      return null
    }

    const { data: publicUrlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(data.path)

    return publicUrlData.publicUrl
  } catch (error) {
    console.error('Upload error:', error)
    return null
  }
}

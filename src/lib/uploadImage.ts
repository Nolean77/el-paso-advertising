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
): Promise<string> {
  const mimeType = file.type || 'image/jpeg'
  const fileExt = getFileExtension(file.type, fileName)
  const timestamp = Date.now()

  const tryUpload = async (ownerId: string) => {
    const filePath = `${ownerId}/${timestamp}.${fileExt}`
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        contentType: mimeType,
        upsert: false,
      })

    if (error) {
      throw new Error(error.message || 'Storage upload failed')
    }

    const { data: publicUrlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(data.path)

    return publicUrlData.publicUrl
  }

  try {
    return await tryUpload(userId)
  } catch (primaryError) {
    const { data: authData } = await supabase.auth.getUser()
    const authUserId = authData?.user?.id

    if (authUserId && authUserId !== userId) {
      try {
        return await tryUpload(authUserId)
      } catch (fallbackError) {
        throw new Error(
          `Upload failed for both client and current user paths. Primary: ${primaryError instanceof Error ? primaryError.message : 'unknown'}. Fallback: ${fallbackError instanceof Error ? fallbackError.message : 'unknown'}`
        )
      }
    }

    throw new Error(primaryError instanceof Error ? primaryError.message : 'Upload failed')
  }
}

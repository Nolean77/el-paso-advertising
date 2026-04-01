import { supabase } from './supabase'

export async function uploadImage(dataUrl: string, userId: string, fileName: string): Promise<string | null> {
  try {
    const base64Data = dataUrl.split(',')[1]
    const mimeType = dataUrl.match(/data:([^;]+);/)?.[1] || 'image/png'
    const fileExt = mimeType.split('/')[1]
    const timestamp = Date.now()
    const filePath = `${userId}/${timestamp}-${fileName}.${fileExt}`

    const byteCharacters = atob(base64Data)
    const byteNumbers = new Array(byteCharacters.length)
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i)
    }
    const byteArray = new Uint8Array(byteNumbers)
    const blob = new Blob([byteArray], { type: mimeType })

    const { data, error } = await supabase.storage
      .from('reference-images')
      .upload(filePath, blob, {
        contentType: mimeType,
        upsert: false,
      })

    if (error) {
      console.error('Upload error:', error)
      return null
    }

    const { data: publicUrlData } = supabase.storage
      .from('reference-images')
      .getPublicUrl(data.path)

    return publicUrlData.publicUrl
  } catch (error) {
    console.error('Upload error:', error)
    return null
  }
}

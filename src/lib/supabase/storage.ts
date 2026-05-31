import { createClient } from './client'

export const QUESTION_IMAGES_BUCKET = 'question-images'

/**
 * Uploads a file to the 'question-images' Supabase Storage bucket.
 * Uses a random UUID as filename to avoid collisions.
 * The bucket must have a public-read policy and allow authenticated/anon uploads.
 */
export async function uploadQuestionImage(
  file: File,
): Promise<{ url: string | null; error: string | null }> {
  const supabase = createClient()

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const path = `${crypto.randomUUID()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from(QUESTION_IMAGES_BUCKET)
    .upload(path, file, { cacheControl: '31536000', upsert: false })

  if (uploadError) return { url: null, error: uploadError.message }

  const { data } = supabase.storage.from(QUESTION_IMAGES_BUCKET).getPublicUrl(path)

  return { url: data.publicUrl, error: null }
}

/**
 * Si `url` apunta a un archivo de nuestro bucket de imágenes, devuelve su path
 * interno (el nombre dentro del bucket). Si es una URL externa o vacía, null.
 * Así solo borramos archivos que hemos subido nosotros, nunca URLs ajenas.
 */
export function bucketPathFromUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const marker = `/${QUESTION_IMAGES_BUCKET}/`
  const idx = url.indexOf(marker)
  if (idx === -1) return null
  const path = url.slice(idx + marker.length).split(/[?#]/)[0]
  return path ? decodeURIComponent(path) : null
}

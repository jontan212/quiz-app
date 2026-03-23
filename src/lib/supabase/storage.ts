import { createClient } from './client'

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
    .from('question-images')
    .upload(path, file, { cacheControl: '31536000', upsert: false })

  if (uploadError) return { url: null, error: uploadError.message }

  const { data } = supabase.storage.from('question-images').getPublicUrl(path)

  return { url: data.publicUrl, error: null }
}

'use server'

import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { bucketPathFromUrl, QUESTION_IMAGES_BUCKET } from '@/lib/supabase/storage'
import { revalidatePath } from 'next/cache'

async function requireAdmin(): Promise<true | { error: string }> {
  const cookieStore = await cookies()
  if (cookieStore.get('admin_session')?.value !== 'true') {
    return { error: 'No autorizado' }
  }
  return true
}

/**
 * Borra del bucket los archivos cuyas URLs son nuestras (ignora URLs externas
 * y duplicados). Best-effort: si la eliminación del Storage falla, no se
 * propaga el error — como mucho queda un archivo huérfano.
 */
async function removeBucketImages(
  supabase: ReturnType<typeof createAdminClient>,
  urls: Array<string | null | undefined>,
): Promise<void> {
  const paths = [...new Set(
    urls.map(bucketPathFromUrl).filter((p): p is string => p !== null),
  )]
  if (paths.length === 0) return
  await supabase.storage.from(QUESTION_IMAGES_BUCKET).remove(paths)
}

export async function deleteQuestion(id: string): Promise<{ error?: string }> {
  const auth = await requireAdmin()
  if (auth !== true) return auth

  const supabase = createAdminClient()

  // Recoger las imágenes antes de borrar las filas, para limpiar el Storage.
  const { data: q } = await supabase
    .from('questions')
    .select('image_url, question_options(image_url)')
    .eq('id', id)
    .single()

  await supabase.from('question_options').delete().eq('question_id', id)
  const { error } = await supabase.from('questions').delete().eq('id', id)
  if (error) return { error: error.message }

  await removeBucketImages(supabase, [
    q?.image_url,
    ...(q?.question_options ?? []).map(o => o.image_url),
  ])

  revalidatePath('/admin/questions')
  return {}
}

export async function updateQuestion(
  id: string,
  data: {
    statement: string
    subject: string
    topic: string
    image_url: string
    explanation: string
    options: Array<{ text: string; is_correct: boolean; image_url: string }>
  },
): Promise<{ error?: string }> {
  const auth = await requireAdmin()
  if (auth !== true) return auth

  const supabase = createAdminClient()

  // Imágenes actuales (antes de actualizar) para detectar las que quedan sin uso.
  const { data: prev } = await supabase
    .from('questions')
    .select('image_url, question_options(image_url)')
    .eq('id', id)
    .single()

  const { error: qError } = await supabase
    .from('questions')
    .update({
      statement: data.statement,
      subject: data.subject,
      topic: data.topic,
      image_url: data.image_url || null,
      explanation: data.explanation || null,
    })
    .eq('id', id)

  if (qError) return { error: qError.message }

  // Replace options: wipe and re-insert
  await supabase.from('question_options').delete().eq('question_id', id)

  const { error: oError } = await supabase.from('question_options').insert(
    data.options.map((opt, i) => ({
      question_id: id,
      text: opt.text || null,
      image_url: opt.image_url || null,
      is_correct: opt.is_correct,
      position: i,
    })),
  )

  if (oError) return { error: oError.message }

  // Limpiar del Storage las imágenes que ya no referencia la pregunta
  // (se han quitado o reemplazado). Solo afecta a archivos de nuestro bucket.
  const newPaths = new Set(
    [data.image_url, ...data.options.map(o => o.image_url)]
      .map(bucketPathFromUrl)
      .filter((p): p is string => p !== null),
  )
  const orphanUrls = [
    prev?.image_url,
    ...(prev?.question_options ?? []).map(o => o.image_url),
  ].filter(url => {
    const path = bucketPathFromUrl(url)
    return path !== null && !newPaths.has(path)
  })
  await removeBucketImages(supabase, orphanUrls)

  revalidatePath('/admin/questions')
  revalidatePath(`/admin/questions/${id}/edit`)
  return {}
}

export async function deleteManyQuestions(ids: string[]): Promise<{ error?: string }> {
  const auth = await requireAdmin()
  if (auth !== true) return auth
  if (ids.length === 0) return {}

  const supabase = createAdminClient()

  // Recoger imágenes antes de borrar, para limpiar el Storage.
  const { data: qs } = await supabase
    .from('questions')
    .select('image_url, question_options(image_url)')
    .in('id', ids)

  const { error: optsError } = await supabase
    .from('question_options')
    .delete()
    .in('question_id', ids)
  if (optsError) return { error: optsError.message }

  const { error } = await supabase.from('questions').delete().in('id', ids)
  if (error) return { error: error.message }

  await removeBucketImages(
    supabase,
    (qs ?? []).flatMap(q => [q.image_url, ...(q.question_options ?? []).map(o => o.image_url)]),
  )

  revalidatePath('/admin/questions')
  return {}
}

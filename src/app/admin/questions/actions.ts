'use server'

import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

async function requireAdmin(): Promise<true | { error: string }> {
  const cookieStore = await cookies()
  if (cookieStore.get('admin_session')?.value !== 'true') {
    return { error: 'No autorizado' }
  }
  return true
}

export async function deleteQuestion(id: string): Promise<{ error?: string }> {
  const auth = await requireAdmin()
  if (auth !== true) return auth

  const supabase = createAdminClient()
  await supabase.from('question_options').delete().eq('question_id', id)
  const { error } = await supabase.from('questions').delete().eq('id', id)
  if (error) return { error: error.message }

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

  revalidatePath('/admin/questions')
  revalidatePath(`/admin/questions/${id}/edit`)
  return {}
}

export async function deleteManyQuestions(ids: string[]): Promise<{ error?: string }> {
  const auth = await requireAdmin()
  if (auth !== true) return auth
  if (ids.length === 0) return {}

  const supabase = createAdminClient()
  const { error: optsError } = await supabase
    .from('question_options')
    .delete()
    .in('question_id', ids)
  if (optsError) return { error: optsError.message }

  const { error } = await supabase.from('questions').delete().in('id', ids)
  if (error) return { error: error.message }

  revalidatePath('/admin/questions')
  return {}
}

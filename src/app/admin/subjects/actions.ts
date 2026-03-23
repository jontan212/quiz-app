'use server'

import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

async function requireAdmin(): Promise<{ error: string } | null> {
  const cookieStore = await cookies()
  if (cookieStore.get('admin_session')?.value !== 'true') {
    return { error: 'No autorizado' }
  }
  return null
}

export async function addSubject(name: string): Promise<{ error?: string }> {
  const auth = await requireAdmin()
  if (auth) return auth
  if (!name.trim()) return { error: 'El nombre no puede estar vacío.' }

  const supabase = createAdminClient()
  const { error } = await supabase.from('subjects').insert({ name: name.trim() })
  if (error) {
    return { error: error.code === '23505' ? 'Ya existe esa asignatura.' : error.message }
  }

  revalidatePath('/admin/subjects')
  revalidatePath('/admin')
  return {}
}

export async function addTopic(subjectId: string, name: string): Promise<{ error?: string }> {
  const auth = await requireAdmin()
  if (auth) return auth
  if (!name.trim() || !subjectId) return { error: 'Datos incompletos.' }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('topics')
    .insert({ subject_id: subjectId, name: name.trim() })
  if (error) {
    return { error: error.code === '23505' ? 'Ese tema ya existe en esta asignatura.' : error.message }
  }

  revalidatePath('/admin/subjects')
  revalidatePath('/admin')
  return {}
}

export async function renameSubject(id: string, newName: string): Promise<{ error?: string }> {
  const auth = await requireAdmin()
  if (auth) return auth
  if (!newName.trim()) return { error: 'El nombre no puede estar vacío.' }

  const supabase = createAdminClient()

  const { data: subject } = await supabase
    .from('subjects')
    .select('name')
    .eq('id', id)
    .single()
  if (!subject) return { error: 'Asignatura no encontrada.' }

  const oldName = subject.name
  const trimmed = newName.trim()

  if (oldName === trimmed) return {}

  const { error } = await supabase
    .from('subjects')
    .update({ name: trimmed })
    .eq('id', id)
  if (error) {
    return { error: error.code === '23505' ? 'Ya existe esa asignatura.' : error.message }
  }

  // Cascade to questions.subject (stored as plain text)
  await supabase.from('questions').update({ subject: trimmed }).eq('subject', oldName)

  revalidatePath('/admin/subjects')
  revalidatePath('/admin')
  return {}
}

export async function renameTopic(id: string, newName: string): Promise<{ error?: string }> {
  const auth = await requireAdmin()
  if (auth) return auth
  if (!newName.trim()) return { error: 'El nombre no puede estar vacío.' }

  const supabase = createAdminClient()

  const { data: topic } = await supabase
    .from('topics')
    .select('name, subjects(name)')
    .eq('id', id)
    .single()
  if (!topic) return { error: 'Tema no encontrado.' }

  const oldName = topic.name
  const trimmed = newName.trim()
  const subjectName = (topic.subjects as { name: string }).name

  if (oldName === trimmed) return {}

  const { error } = await supabase
    .from('topics')
    .update({ name: trimmed })
    .eq('id', id)
  if (error) {
    return { error: error.code === '23505' ? 'Ese tema ya existe en esta asignatura.' : error.message }
  }

  // Cascade to questions.topic (stored as plain text, scoped to the subject)
  await supabase
    .from('questions')
    .update({ topic: trimmed })
    .eq('subject', subjectName)
    .eq('topic', oldName)

  revalidatePath('/admin/subjects')
  revalidatePath('/admin')
  return {}
}

export async function deleteSubject(id: string): Promise<{ error?: string }> {
  const auth = await requireAdmin()
  if (auth) return auth

  const supabase = createAdminClient()

  const { data: subject } = await supabase
    .from('subjects')
    .select('name')
    .eq('id', id)
    .single()
  if (!subject) return { error: 'Asignatura no encontrada.' }

  const { count } = await supabase
    .from('questions')
    .select('*', { count: 'exact', head: true })
    .eq('subject', subject.name)
  if (count && count > 0) {
    return { error: `No se puede eliminar: tiene ${count} pregunta${count > 1 ? 's' : ''} asociada${count > 1 ? 's' : ''}.` }
  }

  const { error } = await supabase.from('subjects').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/admin/subjects')
  revalidatePath('/admin')
  return {}
}

export async function deleteTopic(id: string): Promise<{ error?: string }> {
  const auth = await requireAdmin()
  if (auth) return auth

  const supabase = createAdminClient()

  const { data: topic } = await supabase
    .from('topics')
    .select('name, subjects(name)')
    .eq('id', id)
    .single()
  if (!topic) return { error: 'Tema no encontrado.' }

  const subjectName = (topic.subjects as { name: string }).name

  const { count } = await supabase
    .from('questions')
    .select('*', { count: 'exact', head: true })
    .eq('subject', subjectName)
    .eq('topic', topic.name)
  if (count && count > 0) {
    return { error: `No se puede eliminar: tiene ${count} pregunta${count > 1 ? 's' : ''} asociada${count > 1 ? 's' : ''}.` }
  }

  const { error } = await supabase.from('topics').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/admin/subjects')
  revalidatePath('/admin')
  return {}
}

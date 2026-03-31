'use server'

import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

export type ImportRow = {
  subject: string
  topic: string
  statement: string
  options: string[]
  correctIndex: number // 0-based
}

export async function importQuestions(
  rows: ImportRow[],
): Promise<{ imported: number; errors: number; error?: string }> {
  const cookieStore = await cookies()
  if (cookieStore.get('admin_session')?.value !== 'true') {
    return { imported: 0, errors: 0, error: 'No autorizado' }
  }

  const supabase = createAdminClient()
  let imported = 0
  let errors = 0

  // Cache: subject name → subject id
  const subjectIdCache = new Map<string, string>()
  // Cache: `${subjectId}:${topicName}` → topic id (not strictly needed but avoids redundant upserts)
  const topicCache = new Set<string>()

  async function getOrCreateSubject(name: string): Promise<string | null> {
    if (subjectIdCache.has(name)) return subjectIdCache.get(name)!
    // Try upsert (insert or ignore duplicate)
    const { data, error } = await supabase
      .from('subjects')
      .upsert({ name }, { onConflict: 'name' })
      .select('id')
      .single()
    if (error || !data) return null
    subjectIdCache.set(name, data.id)
    return data.id
  }

  async function getOrCreateTopic(subjectId: string, name: string): Promise<void> {
    const key = `${subjectId}:${name}`
    if (topicCache.has(key)) return
    await supabase
      .from('topics')
      .upsert({ subject_id: subjectId, name }, { onConflict: 'subject_id,name' })
    topicCache.add(key)
  }

  for (const row of rows) {
    // Ensure subject and topic exist
    const subjectId = await getOrCreateSubject(row.subject)
    if (subjectId) {
      await getOrCreateTopic(subjectId, row.topic)
    }

    const { data: question, error: qError } = await supabase
      .from('questions')
      .insert({
        statement: row.statement,
        image_url: null,
        subject: row.subject,
        topic: row.topic,
      })
      .select()
      .single()

    if (qError) { errors++; continue }

    const { error: optError } = await supabase
      .from('question_options')
      .insert(
        row.options.map((text, i) => ({
          question_id: question.id,
          text,
          image_url: null,
          is_correct: i === row.correctIndex,
          position: i,
        })),
      )

    if (optError) { errors++; continue }
    imported++
  }

  return { imported, errors }
}

export async function checkDuplicateStatements(
  statements: string[],
): Promise<{ duplicates: string[]; error?: string }> {
  const cookieStore = await cookies()
  if (cookieStore.get('admin_session')?.value !== 'true') {
    return { duplicates: [], error: 'No autorizado' }
  }

  if (statements.length === 0) return { duplicates: [] }

  const supabase = createAdminClient()
  const { data, error } = await supabase.from('questions').select('statement')

  if (error) return { duplicates: [], error: error.message }

  const existingLower = new Set((data ?? []).map((q) => q.statement.toLowerCase()))
  const duplicates = statements.filter((s) => existingLower.has(s.toLowerCase()))

  return { duplicates }
}

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

// Kept for the "add question manually" onBlur check (statement-only)
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

// ─────────────────────────────────────────────────────────────
// Two-level duplicate check: exact vs conflict
// ─────────────────────────────────────────────────────────────

export type ExistingQuestion = {
  id: string
  statement: string
  options: Array<{ text: string; isCorrect: boolean }>
}

export type DuplicateMatch = {
  statementLower: string
  level: 'exact' | 'conflict'
  existing: ExistingQuestion[]
}

type DbOption = { text: string | null; is_correct: boolean; position: number }
type DbQuestion = { id: string; statement: string; question_options: DbOption[] }

function sortedTexts(texts: string[]): string {
  return texts.map(t => t.trim().toLowerCase()).sort().join('\0')
}

function optsKey(opts: DbOption[]): string {
  return sortedTexts(opts.map(o => o.text ?? ''))
}

function correctKey(opts: DbOption[]): string {
  return sortedTexts(opts.filter(o => o.is_correct).map(o => o.text ?? ''))
}

function incomingOptsKey(options: string[]): string {
  return sortedTexts(options)
}

function incomingCorrectKey(options: string[], correctIndex: number): string {
  return (options[correctIndex] ?? '').trim().toLowerCase()
}

export async function checkDuplicateDetails(
  incoming: Array<{ statement: string; options: string[]; correctIndex: number }>,
): Promise<{ matches: DuplicateMatch[]; error?: string }> {
  const cookieStore = await cookies()
  if (cookieStore.get('admin_session')?.value !== 'true') {
    return { matches: [], error: 'No autorizado' }
  }
  if (incoming.length === 0) return { matches: [] }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('questions')
    .select('id, statement, question_options(text, is_correct, position)')

  if (error) return { matches: [], error: error.message }

  // Group existing by lowercased statement
  const byStmt = new Map<string, DbQuestion[]>()
  for (const q of (data ?? []) as DbQuestion[]) {
    const key = q.statement.toLowerCase()
    const arr = byStmt.get(key) ?? []
    arr.push(q)
    byStmt.set(key, arr)
  }

  const results: DuplicateMatch[] = []

  for (const row of incoming) {
    const key = row.statement.toLowerCase()
    const matches = byStmt.get(key)
    if (!matches || matches.length === 0) continue

    const iKey = incomingOptsKey(row.options)
    const iCorrect = incomingCorrectKey(row.options, row.correctIndex)

    // Worst level across all matches (conflict beats exact)
    let level: 'exact' | 'conflict' = 'exact'
    for (const m of matches) {
      const eKey = optsKey(m.question_options)
      const eCorrect = correctKey(m.question_options)
      if (iKey !== eKey || iCorrect !== eCorrect) { level = 'conflict'; break }
    }

    results.push({
      statementLower: key,
      level,
      existing: matches.map(m => ({
        id: m.id,
        statement: m.statement,
        options: [...m.question_options]
          .sort((a, b) => a.position - b.position)
          .map(o => ({ text: o.text ?? '', isCorrect: o.is_correct })),
      })),
    })
  }

  return { matches: results }
}

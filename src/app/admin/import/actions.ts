'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { normalizeText, canonicalizeName } from '@/lib/normalize'

export type ImportRow = {
  subject: string
  topic: string
  statement: string
  options: string[]
  correctIndex: number // 0-based
  imageUrl?: string | null // imagen de la pregunta (opcional)
  optionImages?: (string | null)[] // imagen por opción, paralelo a `options` (opcional)
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

  async function getOrCreateSubject(rawName: string): Promise<string | null> {
    const name = canonicalizeName(rawName)
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

  async function getOrCreateTopic(subjectId: string, rawName: string): Promise<void> {
    const name = canonicalizeName(rawName)
    const key = `${subjectId}:${name}`
    if (topicCache.has(key)) return
    await supabase
      .from('topics')
      .upsert({ subject_id: subjectId, name }, { onConflict: 'subject_id,name' })
    topicCache.add(key)
  }

  for (const row of rows) {
    // Ensure subject and topic exist (forma canónica, igual que el catálogo)
    const subjectName = canonicalizeName(row.subject)
    const topicName = canonicalizeName(row.topic)
    const subjectId = await getOrCreateSubject(row.subject)
    if (subjectId) {
      await getOrCreateTopic(subjectId, row.topic)
    }

    const { data: question, error: qError } = await supabase
      .from('questions')
      .insert({
        statement: row.statement,
        image_url: row.imageUrl ?? null,
        subject: subjectName,
        topic: topicName,
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
          image_url: row.optionImages?.[i] ?? null,
          is_correct: i === row.correctIndex,
          position: i,
        })),
      )

    if (optError) { errors++; continue }
    imported++
  }

  revalidatePath('/')
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

  const existingLower = new Set((data ?? []).map((q) => normalizeText(q.statement)))
  const duplicates = statements.filter((s) => existingLower.has(normalizeText(s)))

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
  return texts.map(normalizeText).sort().join('\0')
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
  return normalizeText(options[correctIndex] ?? '')
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

  // Group existing by normalized statement
  const byStmt = new Map<string, DbQuestion[]>()
  for (const q of (data ?? []) as DbQuestion[]) {
    const key = normalizeText(q.statement)
    const arr = byStmt.get(key) ?? []
    arr.push(q)
    byStmt.set(key, arr)
  }

  const results: DuplicateMatch[] = []

  for (const row of incoming) {
    const key = normalizeText(row.statement)
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

// ─────────────────────────────────────────────────────────────
// Detectar asignaturas y temas nuevos (no existen aún en BD)
// ─────────────────────────────────────────────────────────────

export async function checkNewSubjectsTopics(
  rows: Array<{ subject: string; topic: string }>,
): Promise<{
  newSubjects: string[]
  newTopics: Array<{ subject: string; topic: string }>
  error?: string
}> {
  const cookieStore = await cookies()
  if (cookieStore.get('admin_session')?.value !== 'true') {
    return { newSubjects: [], newTopics: [], error: 'No autorizado' }
  }
  if (rows.length === 0) return { newSubjects: [], newTopics: [] }

  const supabase = createAdminClient()
  const [{ data: subjectsData }, { data: topicsData }] = await Promise.all([
    supabase.from('subjects').select('id, name'),
    supabase.from('topics').select('subject_id, name'),
  ])

  // El criterio debe coincidir EXACTAMENTE con el del upsert de importQuestions
  // (canonicalizeName), o el preview diría "0 nuevas" mientras el import crea
  // duplicados por mayúsculas/espacios.

  // id → name canónico para hacer join con topics
  const subjectById = new Map(
    (subjectsData ?? []).map(s => [s.id, canonicalizeName(s.name)])
  )
  // name canónico → exists
  const existingSubjectNames = new Set(
    (subjectsData ?? []).map(s => canonicalizeName(s.name))
  )
  // "subjectName:topicName" canónico → exists
  const existingTopicKeys = new Set(
    (topicsData ?? []).map(t => `${subjectById.get(t.subject_id) ?? ''}:${canonicalizeName(t.name)}`)
  )

  // Asignaturas nuevas (deduplicadas por forma canónica)
  const seenSubjects = new Set<string>()
  const newSubjects: string[] = []
  for (const row of rows) {
    const canon = canonicalizeName(row.subject)
    if (!existingSubjectNames.has(canon) && !seenSubjects.has(canon)) {
      seenSubjects.add(canon)
      newSubjects.push(canon)
    }
  }

  // Temas nuevos (deduplicados por forma canónica)
  const seenTopics = new Set<string>()
  const newTopics: Array<{ subject: string; topic: string }> = []
  for (const row of rows) {
    const canonSubject = canonicalizeName(row.subject)
    const canonTopic = canonicalizeName(row.topic)
    const key = `${canonSubject}:${canonTopic}`
    if (!existingTopicKeys.has(key) && !seenTopics.has(key)) {
      seenTopics.add(key)
      newTopics.push({ subject: canonSubject, topic: canonTopic })
    }
  }

  return { newSubjects, newTopics }
}

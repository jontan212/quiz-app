'use server'

import { createAdminClient } from '@/lib/supabase/admin'

export async function saveSession(data: {
  subject: string
  topics: string[]
  correct: number
  total: number
  answers?: { question_id: string; correct: boolean }[]
}): Promise<{ sessionId?: string; error?: string }> {
  const supabase = createAdminClient()
  console.log('[saveSession] inserting session, answers count:', data.answers?.length ?? 0)

  const { data: session, error } = await supabase
    .from('sessions')
    .insert({
      subject: data.subject,
      topics: data.topics,
      total_questions: data.total,
      correct_answers: data.correct,
      finished_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error) {
    console.error('[saveSession] session insert error:', error.message)
    return { error: error.message }
  }
  console.log('[saveSession] session created:', session.id)

  if (data.answers && data.answers.length > 0) {
    console.log('[saveSession] inserting', data.answers.length, 'session_answers rows')
    const { error: answersError } = await supabase.from('session_answers').insert(
      data.answers.map(a => ({
        session_id: session.id,
        question_id: a.question_id,
        answered_correctly: a.correct,
      })),
    )
    if (answersError) {
      console.error('[saveSession] session_answers insert error:', answersError.message)
      return { sessionId: session.id, error: answersError.message }
    }
    console.log('[saveSession] session_answers saved OK')
  }

  return { sessionId: session.id }
}

export async function saveSessionAnswers(
  sessionId: string,
  answers: { question_id: string; correct: boolean }[],
): Promise<{ error?: string }> {
  if (!sessionId || answers.length === 0) return {}
  const supabase = createAdminClient()
  const { error } = await supabase.from('session_answers').insert(
    answers.map(a => ({
      session_id: sessionId,
      question_id: a.question_id,
      answered_correctly: a.correct,
    })),
  )
  if (error) return { error: error.message }
  return {}
}

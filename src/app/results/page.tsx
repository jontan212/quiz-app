import { createAdminClient } from '@/lib/supabase/admin'
import { saveSession } from './actions'
import ResultsView from './_components/ResultsView'

export default async function ResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams

  const correct = parseInt(typeof params.correct === 'string' ? params.correct : '0', 10)
  const total = parseInt(typeof params.total === 'string' ? params.total : '0', 10)
  const subject = typeof params.subject === 'string' ? params.subject.trim() : ''
  const topicsRaw = typeof params.topics === 'string' ? params.topics : ''
  const mode = params.mode === 'personal' ? 'personal' : 'guest'
  const testMode = params.testMode === 'exam' ? 'exam' : 'quick'
  const topics = topicsRaw ? topicsRaw.split(',').filter(Boolean) : []

  // Decode per-question answers encoded by TestRunner as "uuid:1,uuid:0,..."
  const answersRaw = typeof params.answers === 'string' ? params.answers : ''
  const answerDetails = answersRaw
    ? answersRaw.split(',').flatMap((entry): { question_id: string; correct: boolean }[] => {
        const [question_id, correctStr] = entry.split(':')
        if (!question_id || question_id.length < 32) return []
        return [{ question_id, correct: correctStr === '1' }]
      })
    : []

  console.log('[results] decoded', answerDetails.length, 'answer details from URL')

  if (!subject || total <= 0 || isNaN(correct) || correct < 0 || correct > total) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
        <div className="text-center space-y-4">
          <p className="text-gray-300">Resultado inválido o sesión expirada.</p>
          <a
            href="/"
            className="inline-block px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl transition-colors text-sm"
          >
            Volver al inicio
          </a>
        </div>
      </div>
    )
  }

  // Guardar en servidor: exactamente una vez, con resultado real
  let saveError: string | undefined
  let sessionId: string | undefined
  if (mode === 'personal') {
    console.log('[results] calling saveSession with', answerDetails.length, 'answers')
    const result = await saveSession({
      subject,
      topics,
      correct,
      total,
      answers: answerDetails.length > 0 ? answerDetails : undefined,
    })
    saveError = result.error
    sessionId = result.sessionId
    if (result.error) console.error('[results] saveSession error:', result.error)
    else console.log('[results] session saved, id:', sessionId)
  }

  // Cargar historial reciente (incluye la sesión recién guardada)
  const supabase = createAdminClient()
  const { data: sessionsData } = await supabase
    .from('sessions')
    .select('id, subject, correct_answers, total_questions, started_at')
    .order('started_at', { ascending: false })
    .limit(5)

  const recentSessions = sessionsData ?? []
  const allForAvg = await supabase
    .from('sessions')
    .select('correct_answers, total_questions')
  const globalAvg =
    allForAvg.data && allForAvg.data.length > 0
      ? Math.round(
          allForAvg.data.reduce(
            (sum, s) => sum + (s.total_questions > 0 ? s.correct_answers / s.total_questions : 0),
            0,
          ) /
            allForAvg.data.length *
            100,
        )
      : null

  const retryParams = new URLSearchParams({
    subject,
    count: String(total),
    mode,
    testMode,
    ...(topics.length > 0 ? { topics: topics.join(',') } : {}),
  })
  const retryUrl = `/test?${retryParams.toString()}`

  return (
    <ResultsView
      correct={correct}
      total={total}
      subject={subject}
      topics={topics}
      mode={mode}
      retryUrl={retryUrl}
      saveError={saveError}
      sessionId={sessionId}
      recentSessions={recentSessions}
      globalAvg={globalAvg}
    />
  )
}

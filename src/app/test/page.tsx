import { createAdminClient } from '@/lib/supabase/admin'
import type { QuestionWithOptions } from '@/lib/types'
import TestRunner from './_components/TestRunner'

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default async function TestPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams

  const subject = typeof params.subject === 'string' ? params.subject.trim() : ''
  const topicsRaw = typeof params.topics === 'string' ? params.topics : ''
  const countRaw = typeof params.count === 'string' ? parseInt(params.count, 10) : 10
  const count = isNaN(countRaw) ? 10 : Math.min(50, Math.max(1, countRaw))
  const mode = params.mode === 'personal' ? 'personal' : 'guest'
  const testMode = params.testMode === 'exam' ? 'exam' : 'quick'
  const topics = topicsRaw ? topicsRaw.split(',').filter(Boolean) : []

  if (!subject) {
    return <ErrorScreen message="Falta la asignatura en los parámetros." />
  }

  const supabase = createAdminClient()
  let query = supabase
    .from('questions')
    .select('*, question_options(*)')
    .eq('subject', subject)

  if (topics.length > 0) {
    query = query.in('topic', topics)
  }

  const { data, error } = await query

  if (error) {
    return <ErrorScreen message="Error al cargar las preguntas. Inténtalo de nuevo." />
  }

  if (!data || data.length === 0) {
    return <ErrorScreen message="No se encontraron preguntas con esos filtros." />
  }

  const questions = shuffle(data)
    .slice(0, count)
    .map(q => ({ ...q, question_options: shuffle(q.question_options) })) as QuestionWithOptions[]

  return <TestRunner questions={questions} mode={mode} testMode={testMode} />
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="text-center space-y-4">
        <p className="text-gray-300">{message}</p>
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

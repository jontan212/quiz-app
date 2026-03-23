import { createAdminClient } from '@/lib/supabase/admin'
import type { QuestionWithOptions } from '@/lib/types'
import TestRunner from '../_components/TestRunner'

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams
  const idsRaw = typeof params.ids === 'string' ? params.ids : ''
  const ids = idsRaw.split(',').map(s => s.trim()).filter(Boolean)

  if (ids.length === 0) {
    return <ErrorScreen message="No hay preguntas falladas para repasar." />
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('questions')
    .select('*, question_options(*)')
    .in('id', ids)

  if (error) {
    return <ErrorScreen message="Error al cargar las preguntas. Inténtalo de nuevo." />
  }

  if (!data || data.length === 0) {
    return <ErrorScreen message="No se encontraron las preguntas solicitadas." />
  }

  const questions = shuffle(data).map(q => ({
    ...q,
    question_options: shuffle(q.question_options),
  })) as QuestionWithOptions[]

  return <TestRunner questions={questions} mode="personal" testMode="quick" />
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

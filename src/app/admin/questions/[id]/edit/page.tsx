import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import type { QuestionWithOptions, Subject, Topic } from '@/lib/types'
import EditQuestionForm from '../../_components/EditQuestionForm'

export default async function EditQuestionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const cookieStore = await cookies()
  if (cookieStore.get('admin_session')?.value !== 'true') {
    redirect('/admin')
  }

  const { id } = await params

  const supabase = createAdminClient()
  const [{ data, error }, { data: subjectsRaw }, { data: topicsRaw }] = await Promise.all([
    supabase.from('questions').select('*, question_options(*)').eq('id', id).single(),
    supabase.from('subjects').select('id, name').order('name'),
    supabase.from('topics').select('id, subject_id, name').order('name'),
  ])

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
        <div className="text-center space-y-4">
          <p className="text-gray-300">Pregunta no encontrada.</p>
          <a
            href="/admin/questions"
            className="inline-block px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl transition-colors text-sm"
          >
            ← Volver a preguntas
          </a>
        </div>
      </div>
    )
  }

  // Sort options by position for a stable initial order
  const question: QuestionWithOptions = {
    ...data,
    question_options: [...data.question_options].sort((a, b) => a.position - b.position),
  }

  const subjects: Subject[] = subjectsRaw ?? []
  const topics: Topic[] = topicsRaw ?? []

  return <EditQuestionForm question={question} subjects={subjects} topics={topics} />
}

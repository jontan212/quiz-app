import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import type { QuestionWithOptions } from '@/lib/types'
import QuestionsManager from './_components/QuestionsManager'

export default async function QuestionsPage() {
  const cookieStore = await cookies()
  if (cookieStore.get('admin_session')?.value !== 'true') {
    redirect('/admin')
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('questions')
    .select('*, question_options(*)')
    .order('subject')
    .order('topic')
    .order('created_at', { ascending: false })

  if (error) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
        <div className="text-center space-y-4">
          <p className="text-red-400">Error al cargar las preguntas: {error.message}</p>
          <a href="/admin" className="text-sm text-blue-400 hover:text-blue-300">
            ← Volver al admin
          </a>
        </div>
      </div>
    )
  }

  return <QuestionsManager questions={(data ?? []) as QuestionWithOptions[]} />
}

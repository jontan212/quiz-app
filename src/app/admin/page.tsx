import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import AdminLogin from './_components/AdminLogin'
import QuestionForm from './_components/QuestionForm'
import type { Subject, Topic } from '@/lib/types'

export default async function AdminPage() {
  const cookieStore = await cookies()
  const isAuthenticated = cookieStore.get('admin_session')?.value === 'true'

  if (!isAuthenticated) return <AdminLogin />

  const supabase = createAdminClient()
  const [{ data: subjectsRaw }, { data: topicsRaw }] = await Promise.all([
    supabase.from('subjects').select('id, name').order('name'),
    supabase.from('topics').select('id, subject_id, name').order('name'),
  ])

  const subjects: Subject[] = subjectsRaw ?? []
  const topics: Topic[] = topicsRaw ?? []

  return (
    <div>
      <div className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-400">Panel de administración</span>
          <div className="flex items-center gap-4">
            <a
              href="/admin/import"
              className="text-sm text-gray-400 hover:text-gray-200 transition-colors font-medium"
            >
              Importar CSV →
            </a>
            <a
              href="/admin/subjects"
              className="text-sm text-gray-400 hover:text-gray-200 transition-colors font-medium"
            >
              Asignaturas →
            </a>
            <a
              href="/admin/questions"
              className="text-sm text-blue-400 hover:text-blue-300 transition-colors font-medium"
            >
              Gestionar preguntas →
            </a>
          </div>
        </div>
      </div>
      <QuestionForm subjects={subjects} topics={topics} />
    </div>
  )
}

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
      <div className="bg-surface-card border-b border-wire">
        <div className="max-w-2xl mx-auto px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm font-medium text-ink-faint">Panel de administración</span>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <a
              href="/admin/import"
              className="text-sm text-ink-faint hover:text-ink transition-colors font-medium"
            >
              Importar CSV →
            </a>
            <a
              href="/admin/subjects"
              className="text-sm text-ink-faint hover:text-ink transition-colors font-medium"
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

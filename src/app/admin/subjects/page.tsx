import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import SubjectsManager from './_components/SubjectsManager'

export default async function SubjectsPage() {
  const cookieStore = await cookies()
  if (cookieStore.get('admin_session')?.value !== 'true') {
    redirect('/admin')
  }

  const supabase = createAdminClient()

  const [{ data: subjectsRaw }, { data: topicsRaw }, { data: questionsRaw }] = await Promise.all([
    supabase.from('subjects').select('id, name').order('name'),
    supabase.from('topics').select('id, subject_id, name').order('name'),
    supabase.from('questions').select('subject, topic'),
  ])

  // Build question counts by subject name and by subject+topic name
  const subjectCounts: Record<string, number> = {}
  const topicCounts: Record<string, Record<string, number>> = {}

  for (const q of questionsRaw ?? []) {
    subjectCounts[q.subject] = (subjectCounts[q.subject] ?? 0) + 1
    if (!topicCounts[q.subject]) topicCounts[q.subject] = {}
    topicCounts[q.subject][q.topic] = (topicCounts[q.subject][q.topic] ?? 0) + 1
  }

  const subjects = (subjectsRaw ?? []).map(s => ({
    id: s.id,
    name: s.name,
    questionCount: subjectCounts[s.name] ?? 0,
    topics: (topicsRaw ?? [])
      .filter(t => t.subject_id === s.id)
      .map(t => ({
        id: t.id,
        subject_id: t.subject_id,
        name: t.name,
        questionCount: topicCounts[s.name]?.[t.name] ?? 0,
      })),
  }))

  return <SubjectsManager subjects={subjects} />
}

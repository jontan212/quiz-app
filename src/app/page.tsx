import { createAdminClient } from '@/lib/supabase/admin'
import TestSetup from './_components/TestSetup'

export default async function HomePage() {
  const supabase = createAdminClient()

  const { data } = await supabase
    .from('questions')
    .select('subject, topic')

  // Construir mapa subject -> topics (deduplicado, ordenado)
  const map: Record<string, Set<string>> = {}
  for (const row of data ?? []) {
    if (!map[row.subject]) map[row.subject] = new Set()
    map[row.subject].add(row.topic)
  }

  const subjectTopics: Record<string, string[]> = {}
  for (const subject of Object.keys(map).sort()) {
    subjectTopics[subject] = [...map[subject]].sort()
  }

  return <TestSetup subjectTopics={subjectTopics} />
}

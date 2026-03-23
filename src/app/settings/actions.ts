'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function deleteAllSessions(): Promise<{ error: string | null }> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('sessions').delete().gte('started_at', '1970-01-01')
  if (error) return { error: error.message }
  revalidatePath('/stats')
  return { error: null }
}

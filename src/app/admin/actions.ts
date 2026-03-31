'use server'

import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import type { CreateQuestionFormData } from '@/lib/types'

// ============================================================
// Autenticación de admin
// ============================================================

export async function login(password: string): Promise<{ error?: string }> {
  if (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) {
    return { error: 'Contraseña incorrecta' }
  }

  const cookieStore = await cookies()
  cookieStore.set('admin_session', 'true', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24, // 24 horas
  })

  return {}
}

// ============================================================
// Crear pregunta con opciones
// ============================================================

export async function createQuestion(
  data: CreateQuestionFormData,
): Promise<{ error?: string }> {
  // Verificar sesión admin
  const cookieStore = await cookies()
  if (cookieStore.get('admin_session')?.value !== 'true') {
    return { error: 'No autorizado' }
  }

  const supabase = createAdminClient()

  // Insertar pregunta
  const { data: question, error: questionError } = await supabase
    .from('questions')
    .insert({
      statement: data.statement,
      image_url: data.image_url || null,
      explanation: data.explanation || null,
      subject: data.subject,
      topic: data.topic,
    })
    .select()
    .single()

  if (questionError) return { error: questionError.message }

  // Insertar opciones
  const { error: optionsError } = await supabase
    .from('question_options')
    .insert(
      data.options.map((opt, i) => ({
        question_id: question.id,
        text: opt.text || null,
        image_url: opt.image_url || null,
        is_correct: opt.is_correct,
        position: i,
      })),
    )

  if (optionsError) return { error: optionsError.message }

  return {}
}

// ============================================================
// Comprobar duplicado de enunciado
// ============================================================

export async function checkStatementDuplicate(
  statement: string,
): Promise<{ isDuplicate: boolean; error?: string }> {
  const cookieStore = await cookies()
  if (cookieStore.get('admin_session')?.value !== 'true') {
    return { isDuplicate: false, error: 'No autorizado' }
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('questions')
    .select('id')
    .ilike('statement', statement.trim())
    .limit(1)

  if (error) return { isDuplicate: false, error: error.message }

  return { isDuplicate: (data?.length ?? 0) > 0 }
}

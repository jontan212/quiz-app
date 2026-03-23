'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteQuestion } from '../actions'
import type { QuestionWithOptions } from '@/lib/types'

type Props = {
  questions: QuestionWithOptions[]
}

export default function QuestionsManager({ questions }: Props) {
  const router = useRouter()
  const [subjectFilter, setSubjectFilter] = useState('')
  const [topicFilter, setTopicFilter] = useState('')
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const subjects = [...new Set(questions.map(q => q.subject))].sort()
  const topics = [
    ...new Set(
      questions
        .filter(q => !subjectFilter || q.subject === subjectFilter)
        .map(q => q.topic),
    ),
  ].sort()

  const filtered = questions.filter(q => {
    if (subjectFilter && q.subject !== subjectFilter) return false
    if (topicFilter && q.topic !== topicFilter) return false
    return true
  })

  function handleSubjectChange(value: string) {
    setSubjectFilter(value)
    setTopicFilter('')
  }

  function handleDelete(id: string) {
    setDeleteError(null)
    startTransition(async () => {
      const result = await deleteQuestion(id)
      if (result.error) {
        setDeleteError(result.error)
      } else {
        router.refresh()
      }
      setConfirmId(null)
    })
  }

  return (
    <div className="min-h-screen bg-gray-950 py-10 px-4">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Gestionar preguntas</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              {filtered.length} de {questions.length} preguntas
            </p>
          </div>
          <a
            href="/admin"
            className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            ← Admin
          </a>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={subjectFilter}
            onChange={e => handleSubjectChange(e.target.value)}
            className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Todas las asignaturas</option>
            {subjects.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <select
            value={topicFilter}
            onChange={e => setTopicFilter(e.target.value)}
            className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Todos los temas</option>
            {topics.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          {(subjectFilter || topicFilter) && (
            <button
              onClick={() => { setSubjectFilter(''); setTopicFilter('') }}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors underline"
            >
              Limpiar filtros
            </button>
          )}
        </div>

        {/* Delete error */}
        {deleteError && (
          <div className="px-4 py-3 bg-red-950/60 border border-red-800 rounded-lg text-red-300 text-sm">
            Error al eliminar: {deleteError}
          </div>
        )}

        {/* List */}
        {filtered.length === 0 ? (
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-12 text-center">
            <p className="text-gray-500 text-sm">No hay preguntas con los filtros seleccionados.</p>
          </div>
        ) : (
          <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
            {filtered.map((q, i) => (
              <div
                key={q.id}
                className={`px-5 py-4 ${i < filtered.length - 1 ? 'border-b border-gray-800/60' : ''}`}
              >
                <div className="flex items-start justify-between gap-4">

                  {/* Question info */}
                  <div className="min-w-0 flex-1 space-y-2">
                    <p className="text-sm text-white font-medium leading-snug line-clamp-2">
                      {q.statement}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 text-xs bg-blue-900/40 text-blue-400 rounded-md font-medium">
                        {q.subject}
                      </span>
                      <span className="px-2 py-0.5 text-xs bg-gray-800 text-gray-400 rounded-md">
                        {q.topic}
                      </span>
                      <span className="text-xs text-gray-600">
                        {q.question_options.length} opciones
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex-shrink-0 flex items-center gap-2">
                    <a
                      href={`/admin/questions/${q.id}/edit`}
                      className="px-3 py-1.5 text-xs font-medium bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors"
                    >
                      Editar
                    </a>

                    {confirmId === q.id ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleDelete(q.id)}
                          disabled={isPending}
                          className="px-3 py-1.5 text-xs font-medium bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white rounded-lg transition-colors"
                        >
                          {isPending ? '…' : 'Confirmar'}
                        </button>
                        <button
                          onClick={() => setConfirmId(null)}
                          disabled={isPending}
                          className="px-3 py-1.5 text-xs font-medium bg-gray-800 hover:bg-gray-700 text-gray-400 rounded-lg transition-colors"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmId(q.id)}
                        className="px-3 py-1.5 text-xs font-medium bg-gray-800 hover:bg-gray-700 text-red-400 hover:text-red-300 rounded-lg transition-colors"
                      >
                        Eliminar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  )
}

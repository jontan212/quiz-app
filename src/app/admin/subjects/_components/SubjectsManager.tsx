'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addSubject, addTopic, deleteSubject, deleteTopic, renameSubject, renameTopic } from '../actions'

type TopicData = {
  id: string
  subject_id: string
  name: string
  questionCount: number
}

type SubjectData = {
  id: string
  name: string
  questionCount: number
  topics: TopicData[]
}

type Props = {
  subjects: SubjectData[]
}

const selectCls =
  'px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
const inputCls =
  'px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
const btnPrimary =
  'px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition-colors'
const btnSecondary =
  'px-2.5 py-1.5 text-xs font-medium bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-lg transition-colors'
const btnDanger =
  'px-2.5 py-1.5 text-xs font-medium bg-gray-800 hover:bg-gray-700 text-red-400 hover:text-red-300 rounded-lg transition-colors'
const btnCancel =
  'px-2.5 py-1.5 text-xs font-medium bg-gray-800 hover:bg-gray-700 text-gray-400 rounded-lg transition-colors'
const btnConfirm =
  'px-2.5 py-1.5 text-xs font-medium bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white rounded-lg transition-colors'

export default function SubjectsManager({ subjects }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // ── New subject form ──
  const [newSubjectName, setNewSubjectName] = useState('')
  const [subjectError, setSubjectError] = useState('')

  // ── Add topic forms (one per subject, keyed by subject id) ──
  const [openTopicForm, setOpenTopicForm] = useState<string | null>(null)
  const [newTopicName, setNewTopicName] = useState('')
  const [topicError, setTopicError] = useState('')

  // ── Inline edit ──
  const [editSubjectId, setEditSubjectId] = useState<string | null>(null)
  const [editSubjectName, setEditSubjectName] = useState('')
  const [editSubjectError, setEditSubjectError] = useState('')
  const [editTopicId, setEditTopicId] = useState<string | null>(null)
  const [editTopicName, setEditTopicName] = useState('')
  const [editTopicError, setEditTopicError] = useState('')

  // ── Delete confirmations ──
  const [confirmSubjectId, setConfirmSubjectId] = useState<string | null>(null)
  const [confirmTopicId, setConfirmTopicId] = useState<string | null>(null)
  const [actionError, setActionError] = useState('')

  function refresh() {
    router.refresh()
  }

  function handleAddSubject() {
    if (!newSubjectName.trim()) { setSubjectError('Escribe un nombre.'); return }
    setSubjectError('')
    startTransition(async () => {
      const result = await addSubject(newSubjectName.trim())
      if (result.error) { setSubjectError(result.error); return }
      setNewSubjectName('')
      refresh()
    })
  }

  function handleAddTopic(subjectId: string) {
    if (!newTopicName.trim()) { setTopicError('Escribe un nombre.'); return }
    setTopicError('')
    startTransition(async () => {
      const result = await addTopic(subjectId, newTopicName.trim())
      if (result.error) { setTopicError(result.error); return }
      setNewTopicName('')
      setOpenTopicForm(null)
      refresh()
    })
  }

  function startEditSubject(id: string, currentName: string) {
    setEditSubjectId(id)
    setEditSubjectName(currentName)
    setEditSubjectError('')
    setConfirmSubjectId(null)
  }

  function cancelEditSubject() {
    setEditSubjectId(null)
    setEditSubjectName('')
    setEditSubjectError('')
  }

  function handleRenameSubject(id: string) {
    if (!editSubjectName.trim()) { setEditSubjectError('Escribe un nombre.'); return }
    setEditSubjectError('')
    startTransition(async () => {
      const result = await renameSubject(id, editSubjectName.trim())
      if (result.error) { setEditSubjectError(result.error); return }
      setEditSubjectId(null)
      refresh()
    })
  }

  function startEditTopic(id: string, currentName: string) {
    setEditTopicId(id)
    setEditTopicName(currentName)
    setEditTopicError('')
    setConfirmTopicId(null)
  }

  function cancelEditTopic() {
    setEditTopicId(null)
    setEditTopicName('')
    setEditTopicError('')
  }

  function handleRenameTopic(id: string) {
    if (!editTopicName.trim()) { setEditTopicError('Escribe un nombre.'); return }
    setEditTopicError('')
    startTransition(async () => {
      const result = await renameTopic(id, editTopicName.trim())
      if (result.error) { setEditTopicError(result.error); return }
      setEditTopicId(null)
      refresh()
    })
  }

  function handleDeleteSubject(id: string) {
    setActionError('')
    startTransition(async () => {
      const result = await deleteSubject(id)
      if (result.error) { setActionError(result.error) }
      else refresh()
      setConfirmSubjectId(null)
    })
  }

  function handleDeleteTopic(id: string) {
    setActionError('')
    startTransition(async () => {
      const result = await deleteTopic(id)
      if (result.error) { setActionError(result.error) }
      else refresh()
      setConfirmTopicId(null)
    })
  }

  return (
    <div className="min-h-screen bg-gray-950 py-10 px-4">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Gestionar asignaturas</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              {subjects.length} asignatura{subjects.length !== 1 ? 's' : ''} ·{' '}
              {subjects.reduce((n, s) => n + s.topics.length, 0)} temas
            </p>
          </div>
          <a href="/admin" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
            ← Admin
          </a>
        </div>

        {/* Global error */}
        {actionError && (
          <div className="px-4 py-3 bg-red-950/60 border border-red-800 rounded-lg text-red-300 text-sm">
            {actionError}
          </div>
        )}

        {/* ── Add subject ── */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5 space-y-3">
          <p className="text-sm font-semibold text-gray-300">Nueva asignatura</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={newSubjectName}
              onChange={e => setNewSubjectName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddSubject()}
              placeholder="Nombre de la asignatura…"
              className={`flex-1 ${inputCls}`}
            />
            <button onClick={handleAddSubject} disabled={isPending} className={btnPrimary}>
              {isPending ? '…' : 'Guardar'}
            </button>
          </div>
          {subjectError && <p className="text-xs text-red-400">{subjectError}</p>}
        </div>

        {/* ── Subjects list ── */}
        {subjects.length === 0 ? (
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-12 text-center">
            <p className="text-gray-500 text-sm">No hay asignaturas todavía.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {subjects.map(subject => (
              <div key={subject.id} className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">

                {/* Subject header */}
                <div className="px-5 py-4 flex items-start justify-between gap-4">
                  {editSubjectId === subject.id ? (
                    <div className="flex-1 space-y-1.5">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={editSubjectName}
                          onChange={e => setEditSubjectName(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleRenameSubject(subject.id)
                            if (e.key === 'Escape') cancelEditSubject()
                          }}
                          autoFocus
                          className={`flex-1 ${inputCls}`}
                        />
                        <button
                          onClick={() => handleRenameSubject(subject.id)}
                          disabled={isPending}
                          className={btnPrimary}
                        >
                          {isPending ? '…' : 'Guardar'}
                        </button>
                        <button onClick={cancelEditSubject} className={btnCancel}>
                          Cancelar
                        </button>
                      </div>
                      {editSubjectError && <p className="text-xs text-red-400">{editSubjectError}</p>}
                    </div>
                  ) : (
                    <div className="min-w-0 flex-1">
                      <span className="text-white font-semibold">{subject.name}</span>
                      <span className="ml-2 text-xs text-gray-500">
                        {subject.questionCount} pregunta{subject.questionCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                  )}

                  {editSubjectId !== subject.id && (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {confirmSubjectId === subject.id ? (
                        <>
                          <button
                            onClick={() => handleDeleteSubject(subject.id)}
                            disabled={isPending}
                            className={btnConfirm}
                          >
                            {isPending ? '…' : 'Confirmar'}
                          </button>
                          <button onClick={() => setConfirmSubjectId(null)} className={btnCancel}>
                            Cancelar
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => startEditSubject(subject.id, subject.name)}
                            className={btnSecondary}
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => { setActionError(''); setConfirmSubjectId(subject.id) }}
                            disabled={subject.questionCount > 0}
                            title={subject.questionCount > 0 ? `Tiene ${subject.questionCount} preguntas asociadas` : 'Eliminar asignatura'}
                            className={`${btnDanger} disabled:opacity-30 disabled:cursor-not-allowed`}
                          >
                            Eliminar
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Topics */}
                {subject.topics.length > 0 && (
                  <div className="border-t border-gray-800 divide-y divide-gray-800/60">
                    {subject.topics.map(topic => (
                      <div key={topic.id} className="px-5 py-3 pl-8 flex items-start justify-between gap-4">
                        {editTopicId === topic.id ? (
                          <div className="flex-1 space-y-1.5">
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={editTopicName}
                                onChange={e => setEditTopicName(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') handleRenameTopic(topic.id)
                                  if (e.key === 'Escape') cancelEditTopic()
                                }}
                                autoFocus
                                className={`flex-1 ${inputCls}`}
                              />
                              <button
                                onClick={() => handleRenameTopic(topic.id)}
                                disabled={isPending}
                                className={btnPrimary}
                              >
                                {isPending ? '…' : 'Guardar'}
                              </button>
                              <button onClick={cancelEditTopic} className={btnCancel}>
                                Cancelar
                              </button>
                            </div>
                            {editTopicError && <p className="text-xs text-red-400">{editTopicError}</p>}
                          </div>
                        ) : (
                          <div className="min-w-0 flex-1">
                            <span className="text-gray-300 text-sm">{topic.name}</span>
                            <span className="ml-2 text-xs text-gray-600">
                              {topic.questionCount} pregunta{topic.questionCount !== 1 ? 's' : ''}
                            </span>
                          </div>
                        )}

                        {editTopicId !== topic.id && (
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {confirmTopicId === topic.id ? (
                              <>
                                <button
                                  onClick={() => handleDeleteTopic(topic.id)}
                                  disabled={isPending}
                                  className={btnConfirm}
                                >
                                  {isPending ? '…' : 'Confirmar'}
                                </button>
                                <button onClick={() => setConfirmTopicId(null)} className={btnCancel}>
                                  Cancelar
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => startEditTopic(topic.id, topic.name)}
                                  className={btnSecondary}
                                >
                                  Editar
                                </button>
                                <button
                                  onClick={() => { setActionError(''); setConfirmTopicId(topic.id) }}
                                  disabled={topic.questionCount > 0}
                                  title={topic.questionCount > 0 ? `Tiene ${topic.questionCount} preguntas asociadas` : 'Eliminar tema'}
                                  className={`${btnDanger} disabled:opacity-30 disabled:cursor-not-allowed`}
                                >
                                  Eliminar
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Add topic row */}
                <div className="border-t border-gray-800 px-5 py-3 pl-8">
                  {openTopicForm === subject.id ? (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newTopicName}
                          onChange={e => setNewTopicName(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleAddTopic(subject.id)}
                          placeholder="Nombre del tema…"
                          autoFocus
                          className={`flex-1 ${inputCls}`}
                        />
                        <button
                          onClick={() => handleAddTopic(subject.id)}
                          disabled={isPending}
                          className={btnPrimary}
                        >
                          {isPending ? '…' : 'Guardar'}
                        </button>
                        <button
                          onClick={() => { setOpenTopicForm(null); setNewTopicName(''); setTopicError('') }}
                          className={btnCancel}
                        >
                          Cancelar
                        </button>
                      </div>
                      {topicError && <p className="text-xs text-red-400">{topicError}</p>}
                    </div>
                  ) : (
                    <button
                      onClick={() => { setOpenTopicForm(subject.id); setNewTopicName(''); setTopicError('') }}
                      className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors"
                    >
                      + Añadir tema
                    </button>
                  )}
                </div>

              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  )
}

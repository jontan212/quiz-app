'use client'

import { useState, useEffect } from 'react'
import { createQuestion, checkStatementDuplicate } from '../actions'
import { uploadQuestionImage } from '@/lib/supabase/storage'
import ImagePicker from './ImagePicker'
import type { Subject, Topic } from '@/lib/types'

// ─── Types ────────────────────────────────────────────────────

type OptionState = {
  text: string
  is_correct: boolean
  imageUrl: string
  imageFile: File | null
}

type QueuedQuestion = {
  qid: string
  statement: string
  subject: string
  topic: string
  imageUrl: string
  imageFile: File | null
  explanation: string
  options: OptionState[]
  hasDuplicateWarning: boolean
}

function emptyOption(): OptionState {
  return { text: '', is_correct: false, imageUrl: '', imageFile: null }
}

// ─── localStorage ─────────────────────────────────────────────

const STORAGE_KEY = 'admin_question_queue_v1'

type PersistedOption = { text: string; is_correct: boolean; imageUrl: string }
type PersistedQuestion = {
  qid: string; statement: string; subject: string; topic: string
  imageUrl: string; explanation: string; hasDuplicateWarning: boolean
  options: PersistedOption[]
}

function loadQueue(): QueuedQuestion[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return (JSON.parse(raw) as PersistedQuestion[]).map(q => ({
      ...q,
      imageFile: null,
      options: q.options.map(o => ({ ...o, imageFile: null })),
    }))
  } catch { return [] }
}

function persistQueue(queue: QueuedQuestion[]) {
  try {
    const data: PersistedQuestion[] = queue.map(q => ({
      qid: q.qid,
      statement: q.statement,
      subject: q.subject,
      topic: q.topic,
      imageUrl: q.imageUrl,
      explanation: q.explanation,
      hasDuplicateWarning: q.hasDuplicateWarning,
      options: q.options.map(o => ({ text: o.text, is_correct: o.is_correct, imageUrl: o.imageUrl })),
    }))
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {}
}

// ─── Component ────────────────────────────────────────────────

type Props = { subjects: Subject[]; topics: Topic[] }

export default function QuestionForm({ subjects, topics }: Props) {

  // ── Form state ───────────────────────────────────────────────
  const [statement, setStatement] = useState('')
  const [subject, setSubject] = useState('')
  const [topic, setTopic] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [explanation, setExplanation] = useState('')
  const [options, setOptions] = useState<OptionState[]>([
    emptyOption(), emptyOption(), emptyOption(), emptyOption(),
  ])
  const [formError, setFormError] = useState('')
  const [duplicateInDb, setDuplicateInDb] = useState(false)
  const [duplicateInQueue, setDuplicateInQueue] = useState(false)
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false)

  // ── Queue state ──────────────────────────────────────────────
  const [queue, setQueue] = useState<QueuedQuestion[]>([])
  const [editingQid, setEditingQid] = useState<string | null>(null)

  // ── Save-all state ───────────────────────────────────────────
  const [isSaving, setIsSaving] = useState(false)
  const [saveResult, setSaveResult] = useState<{ saved: number; errors: number } | null>(null)

  useEffect(() => { setQueue(loadQueue()) }, [])
  useEffect(() => { persistQueue(queue) }, [queue])

  // ── Option helpers ───────────────────────────────────────────
  function addOption() { setOptions(p => [...p, emptyOption()]) }
  function removeOption(i: number) { setOptions(p => p.filter((_, idx) => idx !== i)) }
  function updateOption(i: number, patch: Partial<OptionState>) {
    setOptions(p => p.map((o, idx) => idx === i ? { ...o, ...patch } : o))
  }

  const filteredTopics = topics.filter(t => {
    const s = subjects.find(s => s.name === subject)
    return s ? t.subject_id === s.id : false
  })

  // ── Duplicate check ──────────────────────────────────────────
  async function handleStatementBlur() {
    const trimmed = statement.trim()
    if (!trimmed) return
    const inQueue = queue.some(q =>
      q.qid !== editingQid && q.statement.toLowerCase() === trimmed.toLowerCase()
    )
    setDuplicateInQueue(inQueue)
    setIsCheckingDuplicate(true)
    const { isDuplicate } = await checkStatementDuplicate(trimmed)
    setDuplicateInDb(isDuplicate)
    setIsCheckingDuplicate(false)
  }

  // ── Reset form ───────────────────────────────────────────────
  function resetForm() {
    setStatement(''); setSubject(''); setTopic('')
    setImageUrl(''); setImageFile(null); setExplanation('')
    setOptions([emptyOption(), emptyOption(), emptyOption(), emptyOption()])
    setFormError(''); setDuplicateInDb(false); setDuplicateInQueue(false)
    setEditingQid(null)
  }

  // ── Validate ─────────────────────────────────────────────────
  function validate(): string | null {
    if (!statement.trim()) return 'El enunciado es obligatorio.'
    if (!subject) return 'Selecciona una asignatura.'
    if (!topic) return 'Selecciona un tema.'
    if (options.length < 2) return 'Añade al menos 2 opciones de respuesta.'
    if (options.some(o => !o.text.trim())) return 'Todas las opciones deben tener texto.'
    if (!options.some(o => o.is_correct)) return 'Marca al menos una opción como correcta.'
    return null
  }

  // ── Add / update in queue ────────────────────────────────────
  function handleAddToQueue() {
    const err = validate()
    if (err) { setFormError(err); return }
    setFormError('')

    const item: QueuedQuestion = {
      qid: editingQid ?? Math.random().toString(36).slice(2),
      statement: statement.trim(),
      subject, topic,
      imageUrl, imageFile,
      explanation: explanation.trim(),
      options: options.map(o => ({ ...o })),
      hasDuplicateWarning: duplicateInDb || duplicateInQueue,
    }

    setQueue(prev =>
      editingQid
        ? prev.map(q => q.qid === editingQid ? item : q)
        : [...prev, item]
    )
    setSaveResult(null)
    resetForm()
  }

  // ── Edit from queue ──────────────────────────────────────────
  function handleEdit(qid: string) {
    const item = queue.find(q => q.qid === qid)
    if (!item) return
    setStatement(item.statement)
    setSubject(item.subject)
    setTopic(item.topic)
    setImageUrl(item.imageUrl)
    setImageFile(item.imageFile)
    setExplanation(item.explanation)
    setOptions(item.options.map(o => ({ ...o })))
    setEditingQid(qid)
    setDuplicateInDb(false)
    setDuplicateInQueue(false)
    setFormError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // ── Remove from queue ────────────────────────────────────────
  function handleRemove(qid: string) {
    setQueue(prev => prev.filter(q => q.qid !== qid))
    if (editingQid === qid) resetForm()
  }

  // ── Save all ─────────────────────────────────────────────────
  async function handleSaveAll() {
    if (queue.length === 0 || isSaving) return
    setIsSaving(true)
    setSaveResult(null)

    let saved = 0
    const failedQids = new Set<string>()

    for (const item of queue) {
      try {
        let finalImageUrl = item.imageUrl
        if (item.imageFile) {
          const { url } = await uploadQuestionImage(item.imageFile)
          if (!url) { failedQids.add(item.qid); continue }
          finalImageUrl = url
        }

        const finalOptions: Array<{ text: string; image_url: string; is_correct: boolean; position: number }> = []
        let optFail = false
        for (let i = 0; i < item.options.length; i++) {
          const opt = item.options[i]
          let optImgUrl = opt.imageUrl
          if (opt.imageFile) {
            const { url } = await uploadQuestionImage(opt.imageFile)
            if (!url) { optFail = true; break }
            optImgUrl = url
          }
          finalOptions.push({ text: opt.text.trim(), image_url: optImgUrl, is_correct: opt.is_correct, position: i })
        }
        if (optFail) { failedQids.add(item.qid); continue }

        const result = await createQuestion({
          statement: item.statement,
          subject: item.subject,
          topic: item.topic,
          image_url: finalImageUrl,
          explanation: item.explanation,
          options: finalOptions,
        })

        if (result.error) failedQids.add(item.qid)
        else saved++
      } catch {
        failedQids.add(item.qid)
      }
    }

    setSaveResult({ saved, errors: failedQids.size })
    setIsSaving(false)
    setQueue(prev => prev.filter(q => failedQids.has(q.qid)))
  }

  // ── Render ───────────────────────────────────────────────────
  const isEditing = editingQid !== null

  return (
    <div className="min-h-screen bg-gray-950 py-12 px-4">
      <div className="max-w-2xl mx-auto space-y-12">

        {/* ── FORM ──────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-white">
              {isEditing ? 'Editando pregunta' : 'Nueva pregunta'}
            </h1>
            {isEditing && (
              <button
                type="button"
                onClick={resetForm}
                className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
              >
                Cancelar edición
              </button>
            )}
          </div>

          <div className="space-y-6">

            {/* Enunciado */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Enunciado <span className="text-red-400">*</span>
              </label>
              <textarea
                value={statement}
                onChange={e => { setStatement(e.target.value); setDuplicateInDb(false); setDuplicateInQueue(false) }}
                onBlur={handleStatementBlur}
                rows={3}
                className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                placeholder="Escribe el enunciado de la pregunta…"
              />
              {isCheckingDuplicate && (
                <p className="mt-1.5 text-xs text-gray-500">Comprobando duplicados…</p>
              )}
              {!isCheckingDuplicate && duplicateInDb && (
                <p className="mt-1.5 text-xs text-amber-400">
                  ⚠ Ya existe una pregunta con este enunciado en la base de datos.
                </p>
              )}
              {!isCheckingDuplicate && !duplicateInDb && duplicateInQueue && (
                <p className="mt-1.5 text-xs text-amber-400">
                  ⚠ Ya tienes una pregunta con este enunciado en la cola.
                </p>
              )}
            </div>

            {/* Asignatura + Tema */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Asignatura <span className="text-red-400">*</span>
                </label>
                <select
                  value={subject}
                  onChange={e => { setSubject(e.target.value); setTopic('') }}
                  className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Selecciona una asignatura…</option>
                  {subjects.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Tema <span className="text-red-400">*</span>
                </label>
                <select
                  value={topic}
                  onChange={e => setTopic(e.target.value)}
                  disabled={!subject}
                  className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">Selecciona un tema…</option>
                  {filteredTopics.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                </select>
              </div>
            </div>

            {/* Imagen de la pregunta */}
            <ImagePicker
              label="Imagen de la pregunta"
              optional
              url={imageUrl}
              file={imageFile}
              onUrlChange={setImageUrl}
              onFileChange={setImageFile}
            />

            {/* Opciones */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium text-gray-300">
                  Opciones de respuesta <span className="text-red-400">*</span>
                </label>
                <button
                  type="button"
                  onClick={addOption}
                  className="text-sm text-blue-400 hover:text-blue-300 font-medium transition-colors"
                >
                  + Añadir opción
                </button>
              </div>
              <div className="space-y-2">
                {options.map((opt, i) => (
                  <div
                    key={i}
                    className={`border rounded-lg px-3 py-3 space-y-2.5 transition-colors ${
                      opt.is_correct ? 'bg-green-950/40 border-green-800' : 'bg-gray-800 border-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={opt.is_correct}
                        onChange={e => updateOption(i, { is_correct: e.target.checked })}
                        className="w-4 h-4 accent-green-500 cursor-pointer flex-shrink-0"
                      />
                      <input
                        type="text"
                        value={opt.text}
                        onChange={e => updateOption(i, { text: e.target.value })}
                        placeholder={`Opción ${i + 1}`}
                        className="flex-1 bg-transparent text-white placeholder-gray-500 focus:outline-none text-sm"
                      />
                      {options.length > 2 && (
                        <button
                          type="button"
                          onClick={() => removeOption(i)}
                          className="text-gray-600 hover:text-red-400 transition-colors flex-shrink-0 text-lg leading-none"
                        >
                          ×
                        </button>
                      )}
                    </div>
                    <div className="pl-7">
                      <ImagePicker
                        compact
                        url={opt.imageUrl}
                        file={opt.imageFile}
                        onUrlChange={v => updateOption(i, { imageUrl: v })}
                        onFileChange={f => updateOption(i, { imageFile: f })}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Activa el checkbox de las opciones que son correctas.
              </p>
            </div>

            {/* Explicación */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Explicación <span className="text-gray-500 font-normal">(opcional)</span>
              </label>
              <textarea
                value={explanation}
                onChange={e => setExplanation(e.target.value)}
                rows={3}
                className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                placeholder="Explica por qué esta es la respuesta correcta…"
              />
            </div>

            {/* Error */}
            {formError && (
              <div className="px-4 py-3 bg-red-950/60 border border-red-800 rounded-lg text-red-300 text-sm">
                {formError}
              </div>
            )}

            {/* Botón principal */}
            <button
              type="button"
              onClick={handleAddToQueue}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition-colors"
            >
              {isEditing ? 'Actualizar en cola' : '+ Añadir a la cola'}
            </button>
          </div>
        </div>

        {/* ── COLA ──────────────────────────────────────────── */}
        {queue.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">
                Cola{' '}
                <span className="text-gray-400 font-normal">
                  ({queue.length} {queue.length === 1 ? 'pregunta' : 'preguntas'})
                </span>
              </h2>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => { setQueue([]); if (editingQid) resetForm() }}
                  className="text-sm text-gray-500 hover:text-red-400 transition-colors"
                >
                  Limpiar cola
                </button>
                <button
                  type="button"
                  onClick={handleSaveAll}
                  disabled={isSaving}
                  className="px-4 py-2 bg-green-700 hover:bg-green-600 disabled:bg-green-900 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  {isSaving ? 'Guardando…' : `Guardar todo (${queue.length})`}
                </button>
              </div>
            </div>

            {/* Resultado del guardado */}
            {saveResult && (
              <div className={`mb-4 px-4 py-3 rounded-lg text-sm border ${
                saveResult.errors === 0
                  ? 'bg-green-950/60 border-green-800 text-green-300'
                  : 'bg-amber-950/60 border-amber-800 text-amber-300'
              }`}>
                {saveResult.errors === 0
                  ? `¡${saveResult.saved} ${saveResult.saved === 1 ? 'pregunta guardada' : 'preguntas guardadas'} correctamente!`
                  : `Guardadas ${saveResult.saved}, errores: ${saveResult.errors}. Las preguntas con error permanecen en la cola.`
                }
              </div>
            )}

            {/* Lista */}
            <div className="space-y-2">
              {queue.map((item, idx) => (
                <div
                  key={item.qid}
                  className={`border rounded-lg px-4 py-3 flex items-start gap-3 transition-colors ${
                    item.qid === editingQid
                      ? 'bg-blue-950/40 border-blue-700'
                      : 'bg-gray-800 border-gray-700'
                  }`}
                >
                  <span className="text-gray-500 text-sm font-mono pt-0.5 flex-shrink-0">
                    {idx + 1}.
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{item.statement}</p>
                    <p className="text-gray-400 text-xs mt-0.5">
                      {item.subject} · {item.topic} · {item.options.length} opciones
                    </p>
                    {item.hasDuplicateWarning && (
                      <p className="text-amber-400 text-xs mt-0.5">⚠ Posible duplicado</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => handleEdit(item.qid)}
                      disabled={isSaving}
                      className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50 transition-colors font-medium"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemove(item.qid)}
                      disabled={isSaving}
                      className="text-xs text-gray-500 hover:text-red-400 disabled:opacity-50 transition-colors"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

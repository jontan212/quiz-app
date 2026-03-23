'use client'

import { useState, useTransition } from 'react'
import { updateQuestion } from '../actions'
import { uploadQuestionImage } from '@/lib/supabase/storage'
import ImagePicker from '../../_components/ImagePicker'
import type { QuestionWithOptions, Subject, Topic } from '@/lib/types'

type OptionState = {
  text: string
  is_correct: boolean
  imageUrl: string
  imageFile: File | null
}

type Props = {
  question: QuestionWithOptions
  subjects: Subject[]
  topics: Topic[]
}

export default function EditQuestionForm({ question, subjects, topics }: Props) {
  const [statement, setStatement] = useState(question.statement)
  const [subject, setSubject] = useState(question.subject)
  const [topic, setTopic] = useState(question.topic)
  const [imageUrl, setImageUrl] = useState(question.image_url ?? '')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [explanation, setExplanation] = useState(question.explanation ?? '')
  const [options, setOptions] = useState<OptionState[]>(
    question.question_options.map(o => ({
      text: o.text ?? '',
      is_correct: o.is_correct,
      imageUrl: o.image_url ?? '',
      imageFile: null,
    })),
  )
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()

  const filteredTopics = topics.filter(t => {
    const matched = subjects.find(s => s.name === subject)
    return matched ? t.subject_id === matched.id : false
  })

  function handleSubjectChange(name: string) {
    setSubject(name)
    setTopic('')
  }

  // ── Option helpers ─────────────────────────────────────────

  function addOption() {
    setOptions(prev => [...prev, { text: '', is_correct: false, imageUrl: '', imageFile: null }])
  }

  function removeOption(i: number) {
    setOptions(prev => prev.filter((_, idx) => idx !== i))
  }

  function updateOption(i: number, patch: Partial<OptionState>) {
    setOptions(prev => prev.map((o, idx) => (idx === i ? { ...o, ...patch } : o)))
  }

  // ── Submit ─────────────────────────────────────────────────

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess(false)

    if (!statement.trim() || !subject || !topic) {
      setError('Rellena todos los campos obligatorios.')
      return
    }
    if (options.length < 2) {
      setError('Añade al menos 2 opciones de respuesta.')
      return
    }
    if (options.some(o => !o.text.trim())) {
      setError('Todas las opciones deben tener texto.')
      return
    }
    if (!options.some(o => o.is_correct)) {
      setError('Marca al menos una opción como correcta.')
      return
    }

    startTransition(async () => {
      // 1. Upload main question image if a new file was selected
      let finalImageUrl = imageUrl
      if (imageFile) {
        const { url, error: uploadErr } = await uploadQuestionImage(imageFile)
        if (!url) { setError(`Error al subir la imagen: ${uploadErr}`); return }
        finalImageUrl = url
      }

      // 2. Upload option images
      const finalOptions: Array<{
        text: string
        image_url: string
        is_correct: boolean
      }> = []

      for (let i = 0; i < options.length; i++) {
        const opt = options[i]
        let optImageUrl = opt.imageUrl
        if (opt.imageFile) {
          const { url, error: uploadErr } = await uploadQuestionImage(opt.imageFile)
          if (!url) { setError(`Error al subir la imagen de la opción ${i + 1}: ${uploadErr}`); return }
          optImageUrl = url
        }
        finalOptions.push({
          text: opt.text.trim(),
          image_url: optImageUrl,
          is_correct: opt.is_correct,
        })
      }

      // 3. Save to DB
      const result = await updateQuestion(question.id, {
        statement: statement.trim(),
        subject: subject.trim(),
        topic: topic.trim(),
        image_url: finalImageUrl,
        explanation: explanation.trim(),
        options: finalOptions,
      })

      if (result.error) {
        setError(result.error)
      } else {
        setSuccess(true)
        // Reset pending file state — URLs are now final
        setImageFile(null)
        setImageUrl(finalImageUrl)
        setOptions(prev =>
          prev.map((o, i) => ({ ...o, imageFile: null, imageUrl: finalOptions[i].image_url })),
        )
      }
    })
  }

  // ── Render ─────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-950 py-12 px-4">
      <div className="max-w-2xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Editar pregunta</h1>
            <p className="text-gray-500 text-xs mt-1 font-mono">{question.id}</p>
          </div>
          <a
            href="/admin/questions"
            className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            ← Preguntas
          </a>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Enunciado */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Enunciado <span className="text-red-400">*</span>
            </label>
            <textarea
              value={statement}
              onChange={e => setStatement(e.target.value)}
              rows={3}
              className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Asignatura + Tema */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Asignatura <span className="text-red-400">*</span>
              </label>
              <select
                value={subject}
                onChange={e => handleSubjectChange(e.target.value)}
                className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Selecciona una asignatura…</option>
                {subjects.map(s => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
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
                {filteredTopics.map(t => (
                  <option key={t.id} value={t.name}>{t.name}</option>
                ))}
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
                    opt.is_correct
                      ? 'bg-green-950/40 border-green-800'
                      : 'bg-gray-800 border-gray-700'
                  }`}
                >
                  {/* Row: checkbox + text + delete */}
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
                        title="Eliminar opción"
                        className="text-gray-600 hover:text-red-400 transition-colors flex-shrink-0 text-lg leading-none"
                      >
                        ×
                      </button>
                    )}
                  </div>

                  {/* Row: option image */}
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

          {/* Status */}
          {error && (
            <div className="px-4 py-3 bg-red-950/60 border border-red-800 rounded-lg text-red-300 text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="px-4 py-3 bg-green-950/60 border border-green-800 rounded-lg text-green-300 text-sm">
              Cambios guardados correctamente.
            </div>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
          >
            {isPending ? 'Guardando…' : 'Guardar cambios'}
          </button>

        </form>
      </div>
    </div>
  )
}

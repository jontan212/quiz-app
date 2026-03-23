'use client'

import { useState, useEffect, useTransition } from 'react'
import { deleteAllSessions } from './actions'

const TIMER_DURATIONS = [15, 30, 60, 90] as const

export default function SettingsPage() {
  const [questionCount, setQuestionCount] = useState(10)
  const [timerEnabled, setTimerEnabled] = useState(false)
  const [timerDuration, setTimerDuration] = useState(30)
  const [saved, setSaved] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteStatus, setDeleteStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Load from localStorage
  useEffect(() => {
    const count = localStorage.getItem('quiz_question_count')
    if (count) {
      const n = parseInt(count, 10)
      if (!isNaN(n) && n >= 5 && n <= 50) setQuestionCount(n)
    }
    const timerOn = localStorage.getItem('quiz_timer_enabled')
    if (timerOn !== null) setTimerEnabled(timerOn === 'true')
    const duration = localStorage.getItem('quiz_timer_duration')
    if (duration) {
      const d = parseInt(duration, 10)
      if (TIMER_DURATIONS.includes(d as (typeof TIMER_DURATIONS)[number])) setTimerDuration(d)
    }
  }, [])

  function handleSave() {
    localStorage.setItem('quiz_question_count', String(questionCount))
    localStorage.setItem('quiz_timer_enabled', String(timerEnabled))
    localStorage.setItem('quiz_timer_duration', String(timerDuration))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function handleCountInput(val: string) {
    const n = parseInt(val, 10)
    if (!isNaN(n)) setQuestionCount(Math.min(50, Math.max(5, n)))
  }

  function handleDeleteConfirmed() {
    startTransition(async () => {
      const { error } = await deleteAllSessions()
      if (error) {
        setDeleteError(error)
        setDeleteStatus('error')
      } else {
        setDeleteStatus('success')
      }
      setConfirmDelete(false)
    })
  }

  return (
    <div className="min-h-screen bg-surface-page px-4 py-10 sm:py-14">
      <div className="max-w-lg mx-auto space-y-8">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-ink-strong">Ajustes</h1>
          <p className="text-ink-dim text-sm mt-0.5">Configuración por defecto del test</p>
        </div>

        {/* Question count */}
        <section className="bg-surface-card rounded-2xl p-5 border border-wire space-y-4">
          <h2 className="text-xs font-semibold text-ink-faint uppercase tracking-widest">
            Número de preguntas por defecto
          </h2>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min={5}
              max={50}
              step={5}
              value={questionCount}
              onChange={e => setQuestionCount(Number(e.target.value))}
              className="flex-1 accent-blue-500 cursor-pointer h-2"
            />
            <input
              type="number"
              min={5}
              max={50}
              value={questionCount}
              onChange={e => handleCountInput(e.target.value)}
              className="w-16 px-2 py-1.5 bg-surface-input border border-wire-muted rounded-lg text-ink-strong text-center text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex justify-between text-xs text-ink-ghost px-0.5">
            <span>5</span>
            <span>50</span>
          </div>
        </section>

        {/* Timer */}
        <section className="bg-surface-card rounded-2xl p-5 border border-wire space-y-4">
          <h2 className="text-xs font-semibold text-ink-faint uppercase tracking-widest">
            Temporizador por defecto
          </h2>

          {/* Toggle */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-ink-muted">Activar temporizador</span>
            <button
              onClick={() => setTimerEnabled(v => !v)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-surface-card ${
                timerEnabled ? 'bg-blue-600' : 'bg-surface-hover'
              }`}
              role="switch"
              aria-checked={timerEnabled}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  timerEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Duration selector */}
          <div className={`space-y-2 transition-opacity ${timerEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
            <p className="text-xs text-ink-dim">Segundos por pregunta</p>
            <div className="flex gap-2 flex-wrap">
              {TIMER_DURATIONS.map(d => (
                <button
                  key={d}
                  onClick={() => setTimerDuration(d)}
                  disabled={!timerEnabled}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    timerDuration === d && timerEnabled
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40'
                      : 'bg-surface-input text-ink-muted hover:bg-surface-hover hover:text-ink-strong'
                  }`}
                >
                  {d}s
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Save button */}
        <button
          onClick={handleSave}
          className="w-full py-3.5 px-5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold rounded-xl transition-colors shadow-lg shadow-blue-900/30 text-sm"
        >
          {saved ? 'Guardado' : 'Guardar ajustes'}
        </button>

        {/* Delete history */}
        <section className="bg-surface-card rounded-2xl p-5 border border-wire space-y-4">
          <div>
            <h2 className="text-xs font-semibold text-ink-faint uppercase tracking-widest mb-1">
              Borrar historial
            </h2>
            <p className="text-xs text-ink-ghost">
              Elimina permanentemente todas las sesiones guardadas.
            </p>
          </div>

          {deleteStatus === 'success' && (
            <p className="text-sm text-green-500">Historial eliminado correctamente.</p>
          )}
          {deleteStatus === 'error' && (
            <p className="text-sm text-red-500">Error: {deleteError}</p>
          )}

          {confirmDelete ? (
            <div className="space-y-3">
              <p className="text-sm text-amber-500 font-medium">
                ¿Seguro? Esta acción no se puede deshacer.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleDeleteConfirmed}
                  disabled={isPending}
                  className="flex-1 py-2.5 px-4 bg-red-700 hover:bg-red-600 active:bg-red-800 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors text-sm"
                >
                  {isPending ? 'Eliminando…' : 'Sí, borrar todo'}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  disabled={isPending}
                  className="flex-1 py-2.5 px-4 bg-surface-input hover:bg-surface-hover text-ink-muted font-semibold rounded-xl transition-colors border border-wire-muted text-sm"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => { setDeleteStatus('idle'); setConfirmDelete(true) }}
              className="py-2.5 px-5 bg-surface-input hover:bg-surface-hover active:bg-surface-card text-red-500 hover:text-red-400 font-semibold rounded-xl transition-colors border border-wire-muted text-sm"
            >
              Borrar historial
            </button>
          )}
        </section>

      </div>
    </div>
  )
}

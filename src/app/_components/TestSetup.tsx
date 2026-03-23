'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const LS_KEY = 'quiz_question_count'
const DEFAULT_COUNT = 10
const MIN_COUNT = 5
const MAX_COUNT = 50
const TIMER_DURATIONS = [15, 30, 60, 90] as const

type Props = {
  subjectTopics: Record<string, string[]>
}

export default function TestSetup({ subjectTopics }: Props) {
  const router = useRouter()
  const subjects = Object.keys(subjectTopics)

  const [subject, setSubject] = useState(subjects[0] ?? '')
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set())
  const [count, setCount] = useState(DEFAULT_COUNT)
  const [testMode, setTestMode] = useState<'quick' | 'exam'>('quick')
  const [timerEnabled, setTimerEnabled] = useState(false)
  const [timerType, setTimerType] = useState<'per_question' | 'global'>('per_question')
  const [timerDuration, setTimerDuration] = useState(30)
  const [globalMinutes, setGlobalMinutes] = useState(60)

  // Leer settings guardados
  useEffect(() => {
    const saved = localStorage.getItem(LS_KEY)
    if (saved) {
      const n = parseInt(saved, 10)
      if (!isNaN(n) && n >= MIN_COUNT && n <= MAX_COUNT) setCount(n)
    }
    const tm = localStorage.getItem('quiz_test_mode')
    if (tm === 'quick' || tm === 'exam') setTestMode(tm)
    const te = localStorage.getItem('quiz_timer_enabled')
    if (te !== null) setTimerEnabled(te === 'true')
    const tt = localStorage.getItem('quiz_timer_type')
    if (tt === 'per_question' || tt === 'global') setTimerType(tt)
    const td = localStorage.getItem('quiz_timer_duration')
    if (td) {
      const d = parseInt(td, 10)
      if (!isNaN(d) && TIMER_DURATIONS.includes(d as (typeof TIMER_DURATIONS)[number])) setTimerDuration(d)
    }
    const gm = localStorage.getItem('quiz_timer_global_minutes')
    if (gm) {
      const m = parseInt(gm, 10)
      if (!isNaN(m) && m >= 1 && m <= 180) setGlobalMinutes(m)
    }
  }, [])

  // Persistir settings
  useEffect(() => { localStorage.setItem(LS_KEY, String(count)) }, [count])
  useEffect(() => { localStorage.setItem('quiz_test_mode', testMode) }, [testMode])
  useEffect(() => { localStorage.setItem('quiz_timer_enabled', String(timerEnabled)) }, [timerEnabled])
  useEffect(() => { localStorage.setItem('quiz_timer_type', timerType) }, [timerType])
  useEffect(() => { localStorage.setItem('quiz_timer_duration', String(timerDuration)) }, [timerDuration])
  useEffect(() => { localStorage.setItem('quiz_timer_global_minutes', String(globalMinutes)) }, [globalMinutes])

  // Resetear temas al cambiar asignatura
  useEffect(() => {
    setSelectedTopics(new Set())
  }, [subject])

  const topics = subjectTopics[subject] ?? []
  const allSelected = selectedTopics.size === 0 || selectedTopics.size === topics.length
  const noneSelected = selectedTopics.size === 0

  function toggleTopic(topic: string) {
    setSelectedTopics(prev => {
      const next = new Set(prev)
      if (next.has(topic)) next.delete(topic)
      else next.add(topic)
      return next
    })
  }

  function handleCountInput(val: string) {
    const n = parseInt(val, 10)
    if (!isNaN(n)) setCount(Math.min(MAX_COUNT, Math.max(MIN_COUNT, n)))
  }

  function handleGlobalMinutesInput(val: string) {
    const m = parseInt(val, 10)
    if (!isNaN(m)) setGlobalMinutes(Math.min(180, Math.max(1, m)))
  }

  function startTest(mode: 'personal' | 'guest') {
    const topicList = selectedTopics.size > 0 ? [...selectedTopics] : topics
    const params = new URLSearchParams({
      subject,
      topics: topicList.join(','),
      count: String(count),
      mode,
      testMode,
    })
    router.push(`/test?${params.toString()}`)
  }

  if (subjects.length === 0) {
    return (
      <div className="min-h-screen bg-surface-page flex items-center justify-center px-4">
        <div className="text-center space-y-3">
          <div className="text-4xl">📭</div>
          <p className="text-ink-muted font-medium">No hay preguntas todavía</p>
          <p className="text-ink-dim text-sm">
            Añade preguntas desde el{' '}
            <a href="/admin" className="text-blue-400 hover:text-blue-300 underline">
              panel de administración
            </a>
            .
          </p>
        </div>
      </div>
    )
  }

  const topicSummary =
    selectedTopics.size === 0
      ? 'Todos los temas'
      : selectedTopics.size === 1
        ? '1 tema seleccionado'
        : `${selectedTopics.size} temas seleccionados`

  return (
    <div className="min-h-screen bg-surface-page flex items-start justify-center px-4 py-10 sm:py-16 sm:items-center">
      <div className="w-full max-w-lg">

        {/* Cabecera */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-ink-strong tracking-tight">Configurar test</h1>
          <p className="text-ink-dim mt-1 text-sm">Elige materia, temas y número de preguntas</p>
        </div>

        <div className="space-y-6">

          {/* ── Asignatura ── */}
          <section className="bg-surface-card rounded-2xl p-5 border border-wire">
            <h2 className="text-xs font-semibold text-ink-faint uppercase tracking-widest mb-4">
              Asignatura
            </h2>
            <div className="flex flex-wrap gap-2">
              {subjects.map(s => (
                <button
                  key={s}
                  onClick={() => setSubject(s)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    subject === s
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40'
                      : 'bg-surface-input text-ink-muted hover:bg-surface-hover hover:text-ink-strong'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </section>

          {/* ── Modo de test ── */}
          <section className="bg-surface-card rounded-2xl p-5 border border-wire">
            <h2 className="text-xs font-semibold text-ink-faint uppercase tracking-widest mb-4">
              Modo de test
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => setTestMode('quick')}
                className={`flex-1 py-3 px-4 rounded-xl text-sm font-medium transition-all text-left ${
                  testMode === 'quick'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40'
                    : 'bg-surface-input text-ink-muted hover:bg-surface-hover hover:text-ink-strong'
                }`}
              >
                <span className="block font-semibold">Repaso rápido</span>
                <span className={`block text-xs mt-0.5 ${testMode === 'quick' ? 'text-blue-200' : 'text-ink-dim'}`}>
                  Respuesta inmediata
                </span>
              </button>
              <button
                onClick={() => setTestMode('exam')}
                className={`flex-1 py-3 px-4 rounded-xl text-sm font-medium transition-all text-left ${
                  testMode === 'exam'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40'
                    : 'bg-surface-input text-ink-muted hover:bg-surface-hover hover:text-ink-strong'
                }`}
              >
                <span className="block font-semibold">Modo examen</span>
                <span className={`block text-xs mt-0.5 ${testMode === 'exam' ? 'text-blue-200' : 'text-ink-dim'}`}>
                  Sin corrección hasta el final
                </span>
              </button>
            </div>
          </section>

          {/* ── Temas ── */}
          {topics.length > 0 && (
            <section className="bg-surface-card rounded-2xl p-5 border border-wire">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-semibold text-ink-faint uppercase tracking-widest">
                  Temas
                </h2>
                <span className="text-xs text-ink-dim">{topicSummary}</span>
              </div>

              {/* Acciones rápidas */}
              <div className="flex gap-3 mb-4">
                <button
                  onClick={() => setSelectedTopics(new Set())}
                  className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                    noneSelected
                      ? 'bg-blue-600/20 text-blue-400 border border-blue-600/40'
                      : 'bg-surface-input text-ink-faint hover:bg-surface-hover'
                  }`}
                >
                  Todos
                </button>
                <button
                  onClick={() => setSelectedTopics(new Set(topics))}
                  className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                    allSelected && !noneSelected
                      ? 'bg-blue-600/20 text-blue-400 border border-blue-600/40'
                      : 'bg-surface-input text-ink-faint hover:bg-surface-hover'
                  }`}
                >
                  Seleccionar todos
                </button>
              </div>

              {/* Lista de checkboxes */}
              <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
                {topics.map(t => {
                  const checked = selectedTopics.has(t)
                  return (
                    <label
                      key={t}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors select-none ${
                        checked
                          ? 'bg-blue-600/10 border border-blue-600/30'
                          : 'hover:bg-surface-input border border-transparent'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleTopic(t)}
                        className="w-4 h-4 rounded accent-blue-500 cursor-pointer flex-shrink-0"
                      />
                      <span className={`text-sm ${checked ? 'text-ink-strong' : 'text-ink-muted'}`}>
                        {t}
                      </span>
                    </label>
                  )
                })}
              </div>

              <p className="mt-3 text-xs text-ink-ghost">
                Sin selección se incluyen todos los temas
              </p>
            </section>
          )}

          {/* ── Número de preguntas ── */}
          <section className="bg-surface-card rounded-2xl p-5 border border-wire">
            <h2 className="text-xs font-semibold text-ink-faint uppercase tracking-widest mb-4">
              Número de preguntas
            </h2>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min={MIN_COUNT}
                max={MAX_COUNT}
                step={5}
                value={count}
                onChange={e => setCount(Number(e.target.value))}
                className="flex-1 accent-blue-500 cursor-pointer h-2"
              />
              <input
                type="number"
                min={MIN_COUNT}
                max={MAX_COUNT}
                value={count}
                onChange={e => handleCountInput(e.target.value)}
                className="w-16 px-2 py-1.5 bg-surface-input border border-wire-muted rounded-lg text-ink-strong text-center text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex justify-between text-xs text-ink-ghost mt-2 px-0.5">
              <span>{MIN_COUNT}</span>
              <span>{MAX_COUNT}</span>
            </div>
          </section>

          {/* ── Temporizador ── */}
          <section className="bg-surface-card rounded-2xl p-5 border border-wire space-y-4">
            <h2 className="text-xs font-semibold text-ink-faint uppercase tracking-widest">
              Temporizador
            </h2>

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

            <div className={`space-y-3 transition-opacity ${timerEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
              {/* Type tabs */}
              <div className="flex gap-2">
                <button
                  onClick={() => setTimerType('per_question')}
                  disabled={!timerEnabled}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
                    timerType === 'per_question' && timerEnabled
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40'
                      : 'bg-surface-input text-ink-muted hover:bg-surface-hover hover:text-ink-strong'
                  }`}
                >
                  Por pregunta
                </button>
                <button
                  onClick={() => setTimerType('global')}
                  disabled={!timerEnabled}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
                    timerType === 'global' && timerEnabled
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40'
                      : 'bg-surface-input text-ink-muted hover:bg-surface-hover hover:text-ink-strong'
                  }`}
                >
                  Test completo
                </button>
              </div>

              {/* Per-question config */}
              {timerType === 'per_question' && (
                <div className="flex gap-2">
                  {TIMER_DURATIONS.map(d => (
                    <button
                      key={d}
                      onClick={() => setTimerDuration(d)}
                      disabled={!timerEnabled}
                      className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
                        timerDuration === d && timerEnabled
                          ? 'bg-blue-600/20 text-blue-300 border border-blue-600/50'
                          : 'bg-surface-input text-ink-muted hover:bg-surface-hover hover:text-ink-strong'
                      }`}
                    >
                      {d}s
                    </button>
                  ))}
                </div>
              )}

              {/* Global timer config */}
              {timerType === 'global' && (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-ink-faint flex-shrink-0">Duración total</span>
                  <input
                    type="number"
                    min={1}
                    max={180}
                    value={globalMinutes}
                    onChange={e => handleGlobalMinutesInput(e.target.value)}
                    disabled={!timerEnabled}
                    className="w-20 px-2 py-1.5 bg-surface-input border border-wire-muted rounded-lg text-ink-strong text-center text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <span className="text-sm text-ink-dim">minutos</span>
                </div>
              )}
            </div>
          </section>

          {/* ── Botones de inicio ── */}
          <div className="flex flex-col sm:flex-row gap-3 pt-1">
            <button
              onClick={() => startTest('personal')}
              className="flex-1 py-3.5 px-5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold rounded-xl transition-colors shadow-lg shadow-blue-900/30 text-sm"
            >
              Iniciar test personal
            </button>
            <button
              onClick={() => startTest('guest')}
              className="flex-1 py-3.5 px-5 bg-surface-input hover:bg-surface-hover active:bg-surface-card text-ink font-semibold rounded-xl transition-colors border border-wire-muted text-sm"
            >
              Modo invitado
            </button>
          </div>

        </div>

      </div>
    </div>
  )
}

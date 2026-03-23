'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { QuestionWithOptions } from '@/lib/types'

const PROGRESS_KEY = 'quiz_progress'
const TIMER_OPTIONS = [15, 30, 60, 90]
const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F']

type SavedProgress = {
  questions: QuestionWithOptions[]
  answers: (string | null)[]
  currentIndex: number
  subject: string
}

type Props = {
  questions: QuestionWithOptions[]
  mode: 'personal' | 'guest'
  testMode: 'exam' | 'quick'
}

export default function TestRunner({ questions: initialQuestions, mode, testMode }: Props) {
  const router = useRouter()

  const [questions, setQuestions] = useState<QuestionWithOptions[]>(initialQuestions)
  const [phase, setPhase] = useState<'ready' | 'running' | 'reviewing' | 'done'>('ready')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<(string | null)[]>(
    Array(initialQuestions.length).fill(null),
  )
  const [revealed, setRevealed] = useState(false)
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [timedOut, setTimedOut] = useState(false)
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [flagged, setFlagged] = useState<Set<number>>(new Set())

  function toggleFlag(i: number) {
    setFlagged(prev => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  // Timer state
  const [timerEnabled, setTimerEnabled] = useState(false)
  const [timerType, setTimerType] = useState<'per_question' | 'global'>('per_question')
  const [timerDuration, setTimerDuration] = useState(30)
  const [timeLeft, setTimeLeft] = useState(30)
  const [globalMinutes, setGlobalMinutes] = useState(60)
  const [globalTimeLeft, setGlobalTimeLeft] = useState(0)

  // Refs for stale-closure-safe access inside callbacks
  const answersRef = useRef(answers)
  answersRef.current = answers
  const phaseRef = useRef(phase)
  phaseRef.current = phase
  const revealedRef = useRef(revealed)
  revealedRef.current = revealed
  const currentIndexRef = useRef(currentIndex)
  currentIndexRef.current = currentIndex
  const questionsRef = useRef(questions)
  questionsRef.current = questions
  const testModeRef = useRef(testMode)
  testModeRef.current = testMode
  const timerTypeRef = useRef(timerType)
  timerTypeRef.current = timerType
  const globalMinutesRef = useRef(globalMinutes)
  globalMinutesRef.current = globalMinutes
  const timerEnabledRef = useRef(timerEnabled)
  timerEnabledRef.current = timerEnabled
  // Populated after finishTest is defined below
  const finishTestRef = useRef<((a: (string | null)[]) => void) | null>(null)

  // ── Restore progress (quick + personal mode only) ──
  useEffect(() => {
    if (mode !== 'personal' || testMode !== 'quick') return
    const raw = localStorage.getItem(PROGRESS_KEY)
    if (!raw) return
    try {
      const saved: SavedProgress = JSON.parse(raw)
      if (saved.subject !== initialQuestions[0]?.subject) return
      const serverIds = new Set(initialQuestions.map(q => q.id))
      const savedIds = new Set(saved.questions.map(q => q.id))
      const sameSet =
        serverIds.size === savedIds.size && [...serverIds].every(id => savedIds.has(id))
      if (!sameSet || saved.currentIndex >= saved.questions.length) return
      setQuestions(saved.questions)
      setAnswers(saved.answers)
      setCurrentIndex(saved.currentIndex)
      setSelectedOption(saved.answers[saved.currentIndex])
      setRevealed(saved.answers[saved.currentIndex] !== null)
      setPhase('running')
    } catch {
      // ignore corrupt data
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load timer prefs from localStorage ──
  useEffect(() => {
    const te = localStorage.getItem('quiz_timer_enabled')
    if (te !== null) setTimerEnabled(te === 'true')
    const tt = localStorage.getItem('quiz_timer_type')
    if (tt === 'per_question' || tt === 'global') setTimerType(tt)
    const td = localStorage.getItem('quiz_timer_duration')
    if (td) {
      const d = parseInt(td, 10)
      if (!isNaN(d) && [15, 30, 60, 90].includes(d)) setTimerDuration(d)
    }
    const gm = localStorage.getItem('quiz_timer_global_minutes')
    if (gm) {
      const m = parseInt(gm, 10)
      if (!isNaN(m) && m >= 1 && m <= 180) setGlobalMinutes(m)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Persist progress (quick + personal mode only) ──
  useEffect(() => {
    if (mode !== 'personal' || phase !== 'running' || testMode !== 'quick') return
    const progress: SavedProgress = {
      questions,
      answers,
      currentIndex,
      subject: questions[0]?.subject ?? '',
    }
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress))
  }, [answers, currentIndex, phase]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Reset timer bar when question changes ──
  useEffect(() => {
    setTimeLeft(timerDuration)
    setTimedOut(false)
  }, [currentIndex, timerDuration])

  // ── Timer: decrement ──
  useEffect(() => {
    if (phase !== 'running' || !timerEnabled || revealed || timeLeft <= 0) return
    const id = setTimeout(() => setTimeLeft(t => t - 1), 1000)
    return () => clearTimeout(id)
  }, [phase, timerEnabled, revealed, timeLeft])

  // ── Timer: handle expiry (per-question, quick mode only) ──
  useEffect(() => {
    if (phase !== 'running' || !timerEnabled || revealed || timeLeft !== 0) return
    if (testModeRef.current !== 'quick') return
    setAnswers(prev => {
      const next = [...prev]
      next[currentIndex] = null
      return next
    })
    setTimedOut(true)
    setRevealed(true)
  }, [timeLeft]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Global timer: initialize when test starts ──
  useEffect(() => {
    if (phase !== 'running') return
    if (timerEnabledRef.current && timerTypeRef.current === 'global') {
      setGlobalTimeLeft(globalMinutesRef.current * 60)
    }
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Global timer: decrement ──
  useEffect(() => {
    if (phase !== 'running' || !timerEnabled || timerType !== 'global' || globalTimeLeft <= 0) return
    const id = setTimeout(() => setGlobalTimeLeft(t => t - 1), 1000)
    return () => clearTimeout(id)
  }, [phase, timerEnabled, timerType, globalTimeLeft])

  // ── Global timer: expiry (auto-submit) ──
  useEffect(() => {
    if (phase !== 'running' || globalTimeLeft !== 0) return
    if (!timerEnabledRef.current || timerTypeRef.current !== 'global') return
    if (testModeRef.current === 'exam') {
      setPhase('reviewing')
    } else {
      setPhase('done')
      finishTestRef.current?.(answersRef.current)
    }
  }, [globalTimeLeft]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Keyboard navigation ──
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (phaseRef.current !== 'running') return

      // 1-6 → select option
      const digit = parseInt(e.key, 10)
      if (digit >= 1 && digit <= 6) {
        if (testModeRef.current === 'quick' && revealedRef.current) return
        const opts = questionsRef.current[currentIndexRef.current]?.question_options
        if (!opts) return
        const opt = opts[digit - 1]
        if (!opt) return
        setSelectedOption(opt.id)
        if (testModeRef.current === 'quick') setRevealed(true)
        setAnswers(prev => {
          const next = [...prev]
          next[currentIndexRef.current] = opt.id
          return next
        })
        return
      }

      // Enter / ArrowRight → advance (quick mode only, after reveal)
      if (testModeRef.current === 'quick' &&
          (e.key === 'Enter' || e.key === 'ArrowRight') &&
          revealedRef.current) {
        const nextIndex = currentIndexRef.current + 1
        if (nextIndex >= questionsRef.current.length) {
          setPhase('done')
          finishTestRef.current?.(answersRef.current)
          return
        }
        setCurrentIndex(nextIndex)
        setSelectedOption(answersRef.current[nextIndex])
        setRevealed(answersRef.current[nextIndex] !== null)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps


  // ── Finish test ──
  const finishTest = useCallback(
    (finalAnswers: (string | null)[]) => {
      const correct = questions.filter((q, i) => {
        const id = finalAnswers[i]
        return id ? q.question_options.some(o => o.id === id && o.is_correct) : false
      }).length

      const failedIds = questions
        .filter((q, i) => {
          const answerId = finalAnswers[i]
          return !answerId || !q.question_options.some(o => o.id === answerId && o.is_correct)
        })
        .map(q => q.id)
      localStorage.setItem('quiz_failed_questions', JSON.stringify(failedIds))

      // Encode per-question results in URL so results/page.tsx can save them
      // server-side in a single call, without relying on a client-side relay.
      const answersParam = questions.map((q, i) => {
        const answerId = finalAnswers[i]
        const isCorrect = answerId
          ? q.question_options.some(o => o.id === answerId && o.is_correct)
          : false
        return `${q.id}:${isCorrect ? '1' : '0'}`
      }).join(',')

      console.log('[quiz] finishTest: encoded', questions.length, 'answers for URL')

      if (mode === 'personal') localStorage.removeItem(PROGRESS_KEY)

      const topics = [...new Set(questions.map(q => q.topic))]
      const params = new URLSearchParams({
        correct: String(correct),
        total: String(questions.length),
        subject: questions[0]?.subject ?? '',
        topics: topics.join(','),
        mode,
        testMode: testModeRef.current,
        answers: answersParam,
      })
      router.push(`/results?${params.toString()}`)
    },
    [questions, mode, router],
  )
  finishTestRef.current = finishTest

  // ── Handlers ──────────────────────────────────────────────────

  function handleSelectOption(optionId: string) {
    if (testMode === 'exam') {
      setSelectedOption(optionId)
      setAnswers(prev => {
        const next = [...prev]
        next[currentIndex] = optionId
        return next
      })
    } else {
      if (revealed) return
      setSelectedOption(optionId)
      setAnswers(prev => {
        const next = [...prev]
        next[currentIndex] = optionId
        return next
      })
      setRevealed(true)
    }
  }

  function handleNext() {
    const nextIndex = currentIndex + 1
    if (testMode === 'quick') {
      if (nextIndex >= questions.length) {
        setPhase('done')
        finishTest(answersRef.current)
        return
      }
      setCurrentIndex(nextIndex)
      setSelectedOption(answersRef.current[nextIndex])
      setRevealed(answersRef.current[nextIndex] !== null)
    } else {
      if (nextIndex < questions.length) {
        setCurrentIndex(nextIndex)
        setSelectedOption(answersRef.current[nextIndex])
      }
    }
  }

  function handlePrev() {
    if (currentIndex > 0) {
      const prevIndex = currentIndex - 1
      setCurrentIndex(prevIndex)
      setSelectedOption(answersRef.current[prevIndex])
    }
  }

  function handleSubmit() {
    const unanswered = answers.filter(a => a === null).length
    if (unanswered > 0 || flagged.size > 0) {
      setShowSubmitModal(true)
    } else {
      setPhase('reviewing')
    }
  }

  function navigateTo(i: number) {
    setCurrentIndex(i)
    setSelectedOption(answersRef.current[i])
  }

  // ── Option button style ──
  function optionStyle(optionId: string, isCorrect: boolean): string {
    const base =
      'w-full text-left px-4 py-3.5 rounded-xl text-sm font-medium transition-all border-2 focus:outline-none'
    if (!revealed || testMode === 'exam') {
      return selectedOption === optionId
        ? `${base} bg-blue-600/20 border-blue-500 text-blue-300`
        : `${base} bg-surface-input/60 border-wire-muted text-ink hover:bg-surface-input hover:border-wire cursor-pointer`
    }
    if (isCorrect) return `${base} bg-green-900/40 border-green-600 text-green-200`
    if (selectedOption === optionId) return `${base} bg-red-900/40 border-red-700 text-red-300`
    return `${base} bg-surface-input/30 border-wire text-ink-ghost cursor-default`
  }

  // ─────────────────────────────────────────────────────────────
  // PHASE: ready
  // ─────────────────────────────────────────────────────────────
  if (phase === 'ready') {
    const topicList = [...new Set(questions.map(q => q.topic))]
    return (
      <div className="min-h-screen bg-surface-page flex items-start justify-center px-4 py-10 sm:py-16 sm:items-center">
        <div className="w-full max-w-md space-y-5">
          <div className="text-center space-y-1 pb-2">
            <h1 className="text-3xl font-bold text-ink-strong">¿Listo?</h1>
            <p className="text-ink-dim text-sm">Revisa la configuración antes de empezar</p>
          </div>

          <div className="bg-surface-card rounded-2xl p-5 border border-wire divide-y divide-wire">
            <SummaryRow label="Asignatura" value={questions[0]?.subject ?? '—'} />
            <SummaryRow label="Preguntas" value={String(questions.length)} />
            <SummaryRow
              label="Temas"
              value={topicList.join(', ')}
              small={topicList.length > 2}
            />
            <SummaryRow label="Modo" value={mode === 'personal' ? 'Personal' : 'Invitado'} />
            <SummaryRow label="Tipo" value={testMode === 'exam' ? 'Modo examen' : 'Repaso rápido'} />
          </div>

          {/* Timer */}
          <div className="bg-surface-card rounded-2xl p-5 border border-wire space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-ink">Temporizador</p>
                <p className="text-xs text-ink-dim mt-0.5">
                  {timerType === 'global' ? 'Tiempo total del test' : 'Tiempo límite por pregunta'}
                </p>
              </div>
              <button
                onClick={() => setTimerEnabled(v => !v)}
                aria-pressed={timerEnabled}
                className={`relative w-11 h-6 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-surface-card ${
                  timerEnabled ? 'bg-blue-600' : 'bg-surface-hover'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    timerEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            <div className={`space-y-3 transition-opacity ${timerEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
              {/* Type tabs */}
              <div className="flex gap-2">
                <button
                  onClick={() => setTimerType('per_question')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    timerType === 'per_question'
                      ? 'bg-blue-600 text-white'
                      : 'bg-surface-input text-ink-faint hover:bg-surface-hover'
                  }`}
                >
                  Por pregunta
                </button>
                <button
                  onClick={() => setTimerType('global')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    timerType === 'global'
                      ? 'bg-blue-600 text-white'
                      : 'bg-surface-input text-ink-faint hover:bg-surface-hover'
                  }`}
                >
                  Test completo
                </button>
              </div>
              {/* Per-question duration */}
              {timerType === 'per_question' && (
                <div className="flex gap-2">
                  {TIMER_OPTIONS.map(sec => (
                    <button
                      key={sec}
                      onClick={() => setTimerDuration(sec)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                        timerDuration === sec
                          ? 'bg-blue-600 text-white'
                          : 'bg-surface-input text-ink-faint hover:bg-surface-hover'
                      }`}
                    >
                      {sec}s
                    </button>
                  ))}
                </div>
              )}
              {/* Global timer duration */}
              {timerType === 'global' && (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-ink-faint flex-shrink-0">Duración total</span>
                  <input
                    type="number"
                    min={1}
                    max={180}
                    value={globalMinutes}
                    onChange={e => {
                      const m = parseInt(e.target.value, 10)
                      if (!isNaN(m)) setGlobalMinutes(Math.min(180, Math.max(1, m)))
                    }}
                    className="w-20 px-2 py-1.5 bg-surface-input border border-wire-muted rounded-lg text-ink-strong text-center text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <span className="text-sm text-ink-dim">minutos</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-1">
            <button
              onClick={() => setPhase('running')}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold rounded-xl transition-colors shadow-lg shadow-blue-900/30"
            >
              Empezar test
            </button>
            <a
              href="/"
              className="w-full py-3 bg-surface-input hover:bg-surface-hover text-ink-faint font-medium rounded-xl transition-colors text-center text-sm"
            >
              Volver a configurar
            </a>
          </div>
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────
  // PHASE: done
  // ─────────────────────────────────────────────────────────────
  if (phase === 'done') {
    return (
      <div className="min-h-screen bg-surface-page flex items-center justify-center">
        <p className="text-ink-dim text-sm">Calculando resultados…</p>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────
  // PHASE: reviewing (exam mode — shows all corrections for 3 s)
  // ─────────────────────────────────────────────────────────────
  if (phase === 'reviewing') {
    const correct = questions.filter((q, i) => {
      const a = answers[i]
      return a ? q.question_options.some(o => o.id === a && o.is_correct) : false
    }).length

    return (
      <div className="min-h-screen bg-surface-page">

        {/* Sticky header */}
        <div className="sticky top-0 z-20 bg-surface-page/95 backdrop-blur-sm border-b border-wire/60">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
            <div>
              <p className="text-ink-strong font-semibold tabular-nums">
                {correct} / {questions.length} correctas
              </p>
              <p className="text-xs text-ink-dim mt-0.5">Revisa tus respuestas antes de continuar</p>
            </div>
            <button
              onClick={() => { setPhase('done'); finishTest(answersRef.current) }}
              className="flex-shrink-0 px-4 py-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              Ver resultados →
            </button>
          </div>
        </div>

        {/* All questions with corrections */}
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-8">
          {questions.map((q, qi) => {
            const userAnswer = answers[qi]
            return (
              <div key={q.id} className="space-y-3">
                {/* Question header */}
                <div className="flex items-start gap-2">
                  <span className="flex-shrink-0 text-xs font-bold text-ink-ghost mt-1 w-6 text-right">
                    {qi + 1}.
                  </span>
                  <p className="text-ink-strong text-sm font-medium leading-snug">{q.statement}</p>
                </div>
                {q.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={q.image_url}
                    alt="Imagen"
                    className="ml-8 w-full max-h-48 object-contain rounded-xl bg-surface-input"
                  />
                )}

                {/* Options */}
                <div className="ml-8 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {q.question_options.map((opt, oi) => {
                    const label = OPTION_LABELS[oi] ?? String(oi + 1)
                    const isCorrect = opt.is_correct
                    const isSelected = userAnswer === opt.id
                    let rowCls = 'flex items-start gap-2.5 px-3 py-2.5 rounded-xl text-sm border-2 '
                    let badgeCls = 'flex-shrink-0 w-5 h-5 rounded-md text-xs font-bold flex items-center justify-center mt-0.5 '
                    if (isCorrect) {
                      rowCls += 'bg-green-900/40 border-green-600 text-green-200'
                      badgeCls += 'bg-green-700 text-green-200'
                    } else if (isSelected) {
                      rowCls += 'bg-red-900/40 border-red-700 text-red-300'
                      badgeCls += 'bg-red-800 text-red-300'
                    } else {
                      rowCls += 'bg-surface-input/30 border-wire text-ink-ghost'
                      badgeCls += 'bg-surface-input text-ink-ghost'
                    }
                    return (
                      <div key={opt.id} className={rowCls}>
                        <span className={badgeCls}>
                          {isCorrect ? '✓' : isSelected ? '✗' : label}
                        </span>
                        <span className="flex-1 flex flex-col gap-1">
                          {opt.text && <span>{opt.text}</span>}
                          {opt.image_url && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={opt.image_url}
                              alt={label}
                              className="max-h-16 w-auto object-contain rounded self-start"
                            />
                          )}
                        </span>
                      </div>
                    )
                  })}
                </div>

                {/* Explanation */}
                {q.explanation && (
                  <div className="ml-8 flex gap-3 px-3 py-3 bg-amber-950/30 border border-amber-700/40 rounded-xl">
                    <span className="flex-shrink-0 text-base leading-none mt-0.5">💡</span>
                    <p className="text-amber-200 text-sm leading-relaxed">{q.explanation}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────
  // PHASE: running
  // ─────────────────────────────────────────────────────────────
  const currentQuestion = questions[currentIndex]
  const progressPct = (currentIndex / questions.length) * 100
  const timerPct = timerEnabled ? (timeLeft / timerDuration) * 100 : 100
  const isLast = currentIndex === questions.length - 1
  const answeredCount = answers.filter(a => a !== null).length

  return (
    <div className="min-h-screen bg-surface-page flex flex-col">

      {/* ── Sticky top bar ── */}
      <div className="sticky top-0 z-20 bg-surface-page/95 backdrop-blur-sm border-b border-wire/60">
        <div className="max-w-2xl mx-auto px-4 pt-3 pb-2 space-y-2">

          {testMode === 'exam' ? (
            <>
              {/* Exam: numbered question bubbles */}
              <div className="flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
                {questions.map((_, i) => (
                  <div key={i} className="relative flex-shrink-0">
                    <button
                      onClick={() => navigateTo(i)}
                      className={`w-7 h-7 rounded-lg text-xs font-bold transition-colors ${
                        i === currentIndex
                          ? 'bg-orange-500 text-white'
                          : answers[i] !== null
                            ? 'bg-blue-600 text-white hover:bg-blue-500'
                            : 'bg-surface-input text-ink-faint hover:bg-surface-hover'
                      }`}
                    >
                      {i + 1}
                    </button>
                    {flagged.has(i) && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-400 rounded-full pointer-events-none" />
                    )}
                  </div>
                ))}
              </div>
              {/* Topic + timer + unanswered status */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs px-2.5 py-1 bg-surface-input text-ink-faint rounded-full truncate max-w-[55%]">
                  {currentQuestion.topic}
                </span>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {timerEnabled && timerType === 'global' && (
                    <span className={`text-sm font-mono font-bold tabular-nums ${
                      globalTimeLeft <= 60 ? 'text-red-400' : 'text-ink-muted'
                    }`}>
                      {formatTime(globalTimeLeft)}
                    </span>
                  )}
                  {answeredCount === questions.length ? (
                    <span className="text-xs text-green-400 font-medium tabular-nums">
                      Todas respondidas ✓
                    </span>
                  ) : (
                    <span className="text-xs text-amber-400 tabular-nums">
                      {questions.length - answeredCount} sin responder
                    </span>
                  )}
                </div>
              </div>
              {timerEnabled && timerType === 'global' && (
                <div className="h-0.5 bg-surface-input rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-[width] duration-1000 linear ${
                      globalTimeLeft <= 60 ? 'bg-red-500' : 'bg-amber-400'
                    }`}
                    style={{ width: `${(globalTimeLeft / (globalMinutes * 60)) * 100}%` }}
                  />
                </div>
              )}
            </>
          ) : (
            <>
              {/* Quick: progress text + topic + timer */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-ink-faint font-medium tabular-nums">
                  {currentIndex + 1} / {questions.length}
                </span>
                <span className="text-xs px-2.5 py-1 bg-surface-input text-ink-faint rounded-full truncate max-w-[40%] text-center">
                  {currentQuestion.topic}
                </span>
                {timerEnabled && timerType === 'global' ? (
                  <span className={`text-sm font-mono font-bold tabular-nums text-right ${
                    globalTimeLeft <= 60 ? 'text-red-400' : 'text-ink-muted'
                  }`}>
                    {formatTime(globalTimeLeft)}
                  </span>
                ) : timerEnabled ? (
                  <span
                    className={`text-sm font-mono font-bold tabular-nums w-10 text-right ${
                      timeLeft <= 10 ? 'text-red-400' : 'text-ink-muted'
                    }`}
                  >
                    {timeLeft}s
                  </span>
                ) : (
                  <span className="text-xs text-ink-ghost">{answeredCount} respondidas</span>
                )}
              </div>

              {/* Progress bar */}
              <div className="h-1.5 bg-surface-input rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full transition-[width] duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>

              {/* Timer bar */}
              {timerEnabled && (
                <div className="h-0.5 bg-surface-input rounded-full overflow-hidden">
                  {timerType === 'global' ? (
                    <div
                      className={`h-full rounded-full transition-[width] duration-1000 linear ${
                        globalTimeLeft <= 60 ? 'bg-red-500' : 'bg-amber-400'
                      }`}
                      style={{ width: `${(globalTimeLeft / (globalMinutes * 60)) * 100}%` }}
                    />
                  ) : (
                    <div
                      className={`h-full rounded-full transition-[width] duration-1000 linear ${
                        timeLeft <= 10 ? 'bg-red-500' : 'bg-amber-400'
                      }`}
                      style={{ width: `${timerPct}%` }}
                    />
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full px-4 py-6">

        {timedOut && (
          <div className="mb-4 px-4 py-2.5 bg-amber-900/30 border border-amber-700/40 rounded-xl text-amber-400 text-sm text-center">
            ¡Tiempo agotado!
          </div>
        )}

        {/* Question */}
        <div className="mb-6">
          <p className="text-ink-strong text-lg sm:text-xl font-medium leading-relaxed">
            {currentQuestion.statement}
          </p>
          {currentQuestion.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={currentQuestion.image_url}
              alt="Imagen de la pregunta"
              className="mt-5 w-full max-h-64 object-contain rounded-xl bg-surface-input"
            />
          )}
        </div>

        {/* Options */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {currentQuestion.question_options.map((option, i) => {
            const label = OPTION_LABELS[i] ?? String(i + 1)
            const isCorrect = option.is_correct
            const isSelected = selectedOption === option.id
            const showReveal = testMode === 'quick' && revealed
            return (
              <button
                key={option.id}
                onClick={() => handleSelectOption(option.id)}
                disabled={testMode === 'quick' && revealed}
                className={optionStyle(option.id, isCorrect)}
              >
                <span className="flex items-start gap-3">
                  <span
                    className={`flex-shrink-0 w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center mt-0.5 ${
                      !showReveal
                        ? isSelected
                          ? 'bg-blue-500 text-white'
                          : 'bg-surface-hover text-ink-faint'
                        : isCorrect
                          ? 'bg-green-700 text-green-200'
                          : isSelected
                            ? 'bg-red-800 text-red-300'
                            : 'bg-surface-input text-ink-ghost'
                    }`}
                  >
                    {showReveal && isCorrect ? '✓' : showReveal && isSelected ? '✗' : label}
                  </span>
                  <span className="flex-1 flex flex-col gap-1.5 leading-snug">
                    {option.text && <span>{option.text}</span>}
                    {option.image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={option.image_url}
                        alt={option.text ? `Imagen de la opción ${label}` : label}
                        className="max-h-28 w-auto object-contain rounded-lg self-start"
                      />
                    )}
                  </span>
                </span>
              </button>
            )
          })}
        </div>

        {/* Explanation (quick mode, after revealing) */}
        {testMode === 'quick' && revealed && currentQuestion.explanation && (
          <div className="mt-4 flex gap-3 px-4 py-3.5 bg-amber-950/30 border border-amber-700/40 rounded-xl">
            <span className="flex-shrink-0 text-lg leading-none mt-0.5">💡</span>
            <p className="text-amber-200 text-sm leading-relaxed">{currentQuestion.explanation}</p>
          </div>
        )}

        {/* ── Bottom controls ── */}
        {testMode === 'exam' ? (
          <div className="mt-4 space-y-3">
            {/* Anterior / Abandonar / Siguiente */}
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={handlePrev}
                disabled={currentIndex === 0}
                className="px-5 py-3 bg-surface-input hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed text-ink-muted font-medium rounded-xl transition-colors text-sm"
              >
                ← Anterior
              </button>
              <a href="/" className="text-sm text-ink-ghost hover:text-ink-faint transition-colors">
                Abandonar
              </a>
              <button
                onClick={handleNext}
                disabled={isLast}
                className="px-5 py-3 bg-surface-input hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed text-ink-muted font-medium rounded-xl transition-colors text-sm"
              >
                Siguiente →
              </button>
            </div>

            {/* Marcar para revisar */}
            <button
              type="button"
              onClick={() => toggleFlag(currentIndex)}
              className={`w-full py-2.5 rounded-xl text-sm font-medium transition-colors border ${
                flagged.has(currentIndex)
                  ? 'bg-amber-500/20 border-amber-600/50 text-amber-300 hover:bg-amber-500/30'
                  : 'bg-surface-input border-wire-muted text-ink-faint hover:bg-surface-hover'
              }`}
            >
              {flagged.has(currentIndex) ? '🔖 Marcada para revisar' : '🔖 Marcar para revisar'}
            </button>

            {/* Entregar */}
            <button
              onClick={handleSubmit}
              className="w-full py-3 bg-orange-600/20 hover:bg-orange-600/30 active:bg-orange-600/40 border border-orange-700/50 text-orange-400 font-semibold rounded-xl transition-colors text-sm"
            >
              Entregar examen
            </button>
          </div>
        ) : (
          <div className="mt-4 flex items-center justify-between gap-4">
            <a href="/" className="text-sm text-ink-ghost hover:text-ink-faint transition-colors">
              Abandonar
            </a>
            <button
              onClick={handleNext}
              disabled={!revealed}
              className="px-8 py-3 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:bg-surface-input disabled:text-ink-ghost disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors shadow-lg shadow-blue-900/20 disabled:shadow-none"
            >
              {isLast ? 'Ver resultados' : 'Siguiente →'}
            </button>
          </div>
        )}
      </div>

      {/* ── Submit confirmation modal ── */}
      {showSubmitModal && (() => {
        const unansweredIndices = answers
          .map((a, i) => (a === null ? i + 1 : null))
          .filter((n): n is number => n !== null)
        const flaggedIndices = [...flagged].sort((a, b) => a - b).map(i => i + 1)
        const firstUnanswered = unansweredIndices[0]
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-sm bg-surface-card border border-wire rounded-2xl p-6 space-y-4 shadow-2xl">
              <div>
                <h2 className="text-ink-strong font-bold text-lg">¿Entregar el examen?</h2>
                <p className="text-ink-faint text-sm mt-1">
                  {unansweredIndices.length > 0
                    ? 'Aún tienes preguntas sin responder.'
                    : 'Tienes preguntas marcadas para revisar.'}
                </p>
              </div>

              {unansweredIndices.length > 0 && (
                <div className="px-3 py-2.5 bg-amber-950/40 border border-amber-800/50 rounded-xl">
                  <p className="text-xs text-amber-400 font-medium mb-1">Sin responder:</p>
                  <p className="text-sm text-amber-300 font-mono">
                    {unansweredIndices.join(', ')}
                  </p>
                </div>
              )}

              {flaggedIndices.length > 0 && (
                <div className="px-3 py-2.5 bg-amber-950/40 border border-amber-700/50 rounded-xl space-y-2">
                  <p className="text-xs text-amber-400 font-medium">🔖 Marcadas para revisar:</p>
                  <div className="flex flex-wrap gap-2">
                    {flaggedIndices.map(n => (
                      <button
                        key={n}
                        onClick={() => {
                          setShowSubmitModal(false)
                          navigateTo(n - 1)
                        }}
                        className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-600/50 text-amber-300 text-xs font-bold rounded-lg transition-colors"
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => {
                    setShowSubmitModal(false)
                    if (firstUnanswered !== undefined) navigateTo(firstUnanswered - 1)
                  }}
                  className="flex-1 py-2.5 bg-surface-input hover:bg-surface-hover text-ink font-semibold rounded-xl transition-colors text-sm"
                >
                  Revisar
                </button>
                <button
                  onClick={() => {
                    setShowSubmitModal(false)
                    setPhase('reviewing')
                  }}
                  className="flex-1 py-2.5 bg-orange-600/20 hover:bg-orange-600/30 border border-orange-700/50 text-orange-400 font-semibold rounded-xl transition-colors text-sm"
                >
                  Entregar igualmente
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────
function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function SummaryRow({
  label,
  value,
  small,
}: {
  label: string
  value: string
  small?: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <span className="text-sm text-ink-dim flex-shrink-0">{label}</span>
      <span className={`text-right font-medium text-ink-strong ${small ? 'text-xs' : 'text-sm'}`}>
        {value}
      </span>
    </div>
  )
}

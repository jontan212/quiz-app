'use client'

import { useEffect, useRef, useState } from 'react'

type RecentSession = {
  id: string
  subject: string
  correct_answers: number
  total_questions: number
  started_at: string
}

type Props = {
  correct: number
  total: number
  subject: string
  topics: string[]
  mode: 'personal' | 'guest'
  retryUrl: string
  saveError?: string
  sessionId?: string
  recentSessions: RecentSession[]
  globalAvg: number | null
}

const RADIUS = 70
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

type Level = {
  min: number
  label: string
  sublabel: string
  emoji: string
  color: string       // SVG stroke
  textColor: string   // Tailwind class
  bgColor: string     // Tailwind class (badge bg)
}

const LEVELS: Level[] = [
  {
    min: 90,
    label: '¡Excelente resultado!',
    sublabel: 'Dominas la materia',
    emoji: '🏆',
    color: '#22c55e',
    textColor: 'text-green-500',
    bgColor: 'bg-green-500/10 border-green-500/30',
  },
  {
    min: 70,
    label: '¡Muy bien!',
    sublabel: 'Sólido conocimiento',
    emoji: '🎯',
    color: '#3b82f6',
    textColor: 'text-blue-500',
    bgColor: 'bg-blue-500/10 border-blue-500/30',
  },
  {
    min: 50,
    label: '¡Buen intento!',
    sublabel: 'Sigue practicando',
    emoji: '💪',
    color: '#f59e0b',
    textColor: 'text-amber-500',
    bgColor: 'bg-amber-500/10 border-amber-500/30',
  },
  {
    min: 30,
    label: 'Hay margen de mejora',
    sublabel: 'Repasa los temas y vuelve a intentarlo',
    emoji: '📚',
    color: '#f97316',
    textColor: 'text-orange-500',
    bgColor: 'bg-orange-500/10 border-orange-500/30',
  },
  {
    min: 0,
    label: '¡A estudiar más!',
    sublabel: 'La práctica hace al maestro',
    emoji: '🌱',
    color: '#ef4444',
    textColor: 'text-red-500',
    bgColor: 'bg-red-500/10 border-red-500/30',
  },
]

function getLevel(pct: number): Level {
  return LEVELS.find(l => pct >= l.min) ?? LEVELS[LEVELS.length - 1]
}

export default function ResultsView({
  correct,
  total,
  subject,
  topics,
  mode,
  retryUrl,
  saveError,
  sessionId,
  recentSessions,
  globalAvg,
}: Props) {
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0
  const level = getLevel(pct)

  // Animate circle on mount
  const [animPct, setAnimPct] = useState(0)
  const rafRef = useRef<number>(0)
  useEffect(() => {
    rafRef.current = requestAnimationFrame(() => {
      setAnimPct(pct)
    })
    return () => cancelAnimationFrame(rafRef.current)
  }, [pct])

  // Read failed question IDs saved by TestRunner
  const [reviewUrl, setReviewUrl] = useState<string | null>(null)
  useEffect(() => {
    try {
      const raw = localStorage.getItem('quiz_failed_questions')
      if (raw) {
        const ids: unknown = JSON.parse(raw)
        if (Array.isArray(ids) && ids.length > 0) {
          setReviewUrl(`/test/review?ids=${(ids as string[]).join(',')}`)
        }
      }
    } catch {
      // ignore corrupt data
    }
  }, [])


  const offset = CIRCUMFERENCE * (1 - animPct / 100)

  return (
    <div className="min-h-screen bg-surface-page flex items-start justify-center px-4 py-10 sm:py-16 sm:items-center">
      <div className="w-full max-w-sm space-y-6">

        {/* ── Score circle ── */}
        <div className="flex flex-col items-center gap-4">
          <div className="text-5xl">{level.emoji}</div>

          <div className="relative">
            <svg
              width={RADIUS * 2 + 20}
              height={RADIUS * 2 + 20}
              className="-rotate-90"
              aria-hidden="true"
            >
              {/* Track */}
              <circle
                cx={RADIUS + 10}
                cy={RADIUS + 10}
                r={RADIUS}
                fill="none"
                stroke="var(--wire)"
                strokeWidth={10}
              />
              {/* Progress arc */}
              <circle
                cx={RADIUS + 10}
                cy={RADIUS + 10}
                r={RADIUS}
                fill="none"
                stroke={level.color}
                strokeWidth={10}
                strokeLinecap="round"
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={offset}
                style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1)' }}
              />
            </svg>

            {/* Center text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-ink-strong tabular-nums">
                {correct}/{total}
              </span>
              <span className={`text-sm font-semibold tabular-nums ${level.textColor}`}>
                {pct}%
              </span>
            </div>
          </div>

          {/* Message */}
          <div className="text-center space-y-1">
            <p className="text-xl font-bold text-ink-strong">{level.label}</p>
            <p className="text-sm text-ink-faint">{level.sublabel}</p>
          </div>
        </div>

        {/* ── Stats strip ── */}
        <div className={`rounded-2xl border px-5 py-4 ${level.bgColor}`}>
          <div className="grid grid-cols-3 divide-x divide-wire text-center">
            <StatCell label="Correctas" value={String(correct)} color={level.textColor} />
            <StatCell label="Incorrectas" value={String(total - correct)} color="text-ink-faint" />
            <StatCell label="Total" value={String(total)} color="text-ink-muted" />
          </div>
        </div>

        {/* ── Meta info ── */}
        <div className="bg-surface-card rounded-2xl border border-wire px-5 py-4 space-y-2.5">
          <MetaRow label="Asignatura" value={subject} />
          {topics.length > 0 && (
            <MetaRow label="Temas" value={topics.join(', ')} small={topics.length > 2} />
          )}
          <MetaRow label="Modo" value={mode === 'personal' ? 'Personal' : 'Invitado'} />
          {mode === 'personal' && (
            <p className={`text-xs pt-1 ${saveError ? 'text-red-500' : 'text-ink-ghost'}`}>
              {saveError ? `Error al guardar: ${saveError}` : 'Sesión guardada en tu historial'}
            </p>
          )}
        </div>

        {/* ── Actions ── */}
        <div className="flex flex-col gap-3 pt-1">
          <a
            href={retryUrl}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold rounded-xl transition-colors text-center shadow-lg shadow-blue-900/30"
          >
            Repetir test
          </a>
          {reviewUrl && (
            <a
              href={reviewUrl}
              className="w-full py-3 bg-amber-500/10 hover:bg-amber-500/20 active:bg-amber-500/30 text-amber-500 font-semibold rounded-xl transition-colors text-center text-sm border border-amber-500/30"
            >
              Repasar fallos
            </a>
          )}
          <a
            href="/"
            className="w-full py-3 bg-surface-input hover:bg-surface-hover text-ink-muted font-medium rounded-xl transition-colors text-center text-sm border border-wire"
          >
            Nuevo test
          </a>
        </div>

        {/* ── Recent history ── */}
        {recentSessions.length > 0 && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-ink-dim uppercase tracking-widest">
                Últimos tests
              </h2>
              {globalAvg !== null && (
                <span className="text-xs text-ink-dim">
                  Media global:{' '}
                  <span className={`font-bold ${scoreBadgeColor(globalAvg)}`}>
                    {globalAvg}%
                  </span>
                </span>
              )}
            </div>

            <div className="bg-surface-card rounded-2xl border border-wire overflow-hidden">
              {recentSessions.map((s, i) => {
                const p =
                  s.total_questions > 0
                    ? Math.round((s.correct_answers / s.total_questions) * 100)
                    : 0
                const date = new Date(s.started_at).toLocaleDateString('es-ES', {
                  day: '2-digit',
                  month: 'short',
                })
                return (
                  <div
                    key={s.id}
                    className={`flex items-center justify-between px-4 py-3 gap-3 ${
                      i < recentSessions.length - 1 ? 'border-b border-wire/60' : ''
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-ink-strong font-medium truncate">{s.subject}</p>
                      <p className="text-xs text-ink-ghost">{date}</p>
                    </div>
                    <span
                      className={`flex-shrink-0 text-xs font-bold tabular-nums px-2 py-0.5 rounded-lg ${scoreBadgeBg(p)}`}
                    >
                      {p}%
                    </span>
                  </div>
                )
              })}
            </div>

            <a
              href="/stats"
              className="block text-center text-xs text-ink-ghost hover:text-ink-faint transition-colors"
            >
              Ver estadísticas completas →
            </a>
          </div>
        )}

      </div>
    </div>
  )
}

function scoreBadgeColor(p: number) {
  if (p >= 90) return 'text-green-500'
  if (p >= 70) return 'text-blue-500'
  if (p >= 50) return 'text-amber-500'
  return 'text-red-500'
}

function scoreBadgeBg(p: number) {
  if (p >= 90) return 'bg-green-500/15 text-green-500'
  if (p >= 70) return 'bg-blue-500/15 text-blue-500'
  if (p >= 50) return 'bg-amber-500/15 text-amber-500'
  return 'bg-red-500/15 text-red-500'
}

function StatCell({
  label,
  value,
  color,
}: {
  label: string
  value: string
  color: string
}) {
  return (
    <div className="flex flex-col items-center gap-1 px-3">
      <span className={`text-2xl font-bold tabular-nums ${color}`}>{value}</span>
      <span className="text-xs text-ink-dim">{label}</span>
    </div>
  )
}

function MetaRow({
  label,
  value,
  small,
}: {
  label: string
  value: string
  small?: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-sm text-ink-faint flex-shrink-0">{label}</span>
      <span className={`text-right font-medium text-ink-strong ${small ? 'text-xs' : 'text-sm'}`}>
        {value}
      </span>
    </div>
  )
}

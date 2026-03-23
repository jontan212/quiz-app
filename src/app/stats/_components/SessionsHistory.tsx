'use client'

import { useState, useMemo } from 'react'
import type { Session } from '@/lib/types'

type DateRange = '7d' | '30d' | '90d' | 'all'

type Props = {
  sessions: Session[]
}

const DATE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: 'all', label: 'Todo el historial' },
  { value: '7d', label: 'Últimos 7 días' },
  { value: '30d', label: 'Último mes' },
  { value: '90d', label: 'Últimos 3 meses' },
]

const DATE_DAYS: Record<Exclude<DateRange, 'all'>, number> = { '7d': 7, '30d': 30, '90d': 90 }

function pct(s: Session) {
  return s.total_questions > 0 ? Math.round((s.correct_answers / s.total_questions) * 100) : 0
}

function scoreBadge(p: number) {
  const base = 'inline-block px-2 py-0.5 rounded-lg text-xs font-bold tabular-nums'
  if (p >= 90) return `${base} bg-green-500/15 text-green-500`
  if (p >= 70) return `${base} bg-blue-500/15 text-blue-500`
  if (p >= 50) return `${base} bg-amber-500/15 text-amber-500`
  return `${base} bg-red-500/15 text-red-500`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const selectCls =
  'px-3 py-2 bg-surface-input border border-wire rounded-lg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'

export default function SessionsHistory({ sessions }: Props) {
  const [subjectFilter, setSubjectFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState<DateRange>('all')

  const subjects = useMemo(
    () => [...new Set(sessions.map(s => s.subject))].sort(),
    [sessions],
  )

  const filtered = useMemo(() => {
    let result = sessions
    if (subjectFilter !== 'all') {
      result = result.filter(s => s.subject === subjectFilter)
    }
    if (dateFilter !== 'all') {
      const cutoff = Date.now() - DATE_DAYS[dateFilter] * 24 * 60 * 60 * 1000
      result = result.filter(s => new Date(s.started_at).getTime() >= cutoff)
    }
    return result
  }, [sessions, subjectFilter, dateFilter])

  const isFiltered = subjectFilter !== 'all' || dateFilter !== 'all'

  return (
    <section>
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h2 className="text-xs font-semibold text-ink-dim uppercase tracking-widest">
          Historial de tests
        </h2>
        {isFiltered && (
          <button
            onClick={() => { setSubjectFilter('all'); setDateFilter('all') }}
            className="text-xs text-ink-ghost hover:text-ink-faint transition-colors"
          >
            Limpiar filtros ×
          </button>
        )}
      </div>

      {/* Filter controls */}
      <div className="flex flex-wrap gap-2 mb-3">
        <select
          value={subjectFilter}
          onChange={e => setSubjectFilter(e.target.value)}
          className={selectCls}
        >
          <option value="all">Todas las asignaturas</option>
          {subjects.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          value={dateFilter}
          onChange={e => setDateFilter(e.target.value as DateRange)}
          className={selectCls}
        >
          {DATE_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Count */}
      <p className="text-xs text-ink-ghost mb-3">
        {filtered.length} test{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}
      </p>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="bg-surface-card rounded-2xl border border-wire p-8 text-center">
          <p className="text-sm text-ink-ghost">No hay tests con los filtros aplicados.</p>
        </div>
      ) : (
        <div className="bg-surface-card rounded-2xl border border-wire overflow-hidden">
          {filtered.map((s, i) => {
            const p = pct(s)
            return (
              <div
                key={s.id}
                className={`px-5 py-4 flex items-start justify-between gap-4 ${
                  i < filtered.length - 1 ? 'border-b border-wire/60' : ''
                }`}
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-ink-strong">{s.subject}</span>
                    <span className="text-xs text-ink-ghost">
                      {s.total_questions} preguntas
                    </span>
                  </div>
                  {s.topics.length > 0 && (
                    <p className="text-xs text-ink-dim truncate">{s.topics.join(', ')}</p>
                  )}
                  <p className="text-xs text-ink-ghost">{formatDate(s.started_at)}</p>
                </div>
                <div className="flex-shrink-0 text-right space-y-1">
                  <span className={scoreBadge(p)}>{p}%</span>
                  <p className="text-xs text-ink-ghost tabular-nums">
                    {s.correct_answers}/{s.total_questions}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

import { createAdminClient } from '@/lib/supabase/admin'
import type { Session } from '@/lib/types'
import ProgressChart from './_components/ProgressChart'
import SessionsHistory from './_components/SessionsHistory'

// ── Helpers ──────────────────────────────────────────────────

function pct(s: Session) {
  return s.total_questions > 0
    ? Math.round((s.correct_answers / s.total_questions) * 100)
    : 0
}

function avg(values: number[]) {
  if (values.length === 0) return 0
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length)
}

function formatDate(iso: string, short = false) {
  const d = new Date(iso)
  if (short) {
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
  }
  return d.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function scoreColor(p: number) {
  if (p >= 90) return 'text-green-500'
  if (p >= 70) return 'text-blue-500'
  if (p >= 50) return 'text-amber-500'
  return 'text-red-500'
}

function scoreBadge(p: number) {
  const base = 'inline-block px-2 py-0.5 rounded-lg text-xs font-bold tabular-nums'
  if (p >= 90) return `${base} bg-green-500/15 text-green-500`
  if (p >= 70) return `${base} bg-blue-500/15 text-blue-500`
  if (p >= 50) return `${base} bg-amber-500/15 text-amber-500`
  return `${base} bg-red-500/15 text-red-500`
}

// ─────────────────────────────────────────────────────────────

type HardQuestion = {
  id: string
  statement: string
  subject: string
  topic: string
  wrongCount: number
  totalCount: number
}

export default async function StatsPage() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .order('started_at', { ascending: false })

  const sessions: Session[] = error ? [] : (data ?? [])
  const isEmpty = sessions.length === 0

  // ── Hard questions ───────────────────────────────────────────
  // Two separate queries — avoids relying on PostgREST FK-join cache detection.

  // Step 1: raw answer rows (no join)
  const { data: rawAnswers } = await supabase
    .from('session_answers')
    .select('question_id, answered_correctly')

  // Step 2: aggregate per question
  type Agg = { wrongCount: number; totalCount: number }
  const aggMap = new Map<string, Agg>()
  for (const row of rawAnswers ?? []) {
    const entry = aggMap.get(row.question_id)
    if (entry) {
      entry.totalCount++
      if (!row.answered_correctly) entry.wrongCount++
    } else {
      aggMap.set(row.question_id, {
        wrongCount: row.answered_correctly ? 0 : 1,
        totalCount: 1,
      })
    }
  }

  // Step 3: top 10 IDs by wrongCount
  const topIds = [...aggMap.entries()]
    .filter(([, v]) => v.wrongCount > 0)
    .sort((a, b) => b[1].wrongCount - a[1].wrongCount)
    .slice(0, 10)
    .map(([id]) => id)

  // Step 4: fetch question details for those IDs
  let hardQuestions: HardQuestion[] = []
  if (topIds.length > 0) {
    const { data: questionData } = await supabase
      .from('questions')
      .select('id, statement, subject, topic')
      .in('id', topIds)

    if (questionData) {
      hardQuestions = topIds
        .map(id => {
          const q = questionData.find(q => q.id === id)
          const agg = aggMap.get(id)!
          if (!q) return null
          return {
            id,
            statement: q.statement,
            subject: q.subject,
            topic: q.topic,
            wrongCount: agg.wrongCount,
            totalCount: agg.totalCount,
          }
        })
        .filter((q): q is HardQuestion => q !== null)
    }
  }

  // ── Computed stats ──────────────────────────────────────────

  const totalTests = sessions.length
  const globalAvg = avg(sessions.map(pct))

  // Streak: consecutive tests >= 70% from most recent
  let streak = 0
  for (const s of sessions) {
    if (pct(s) >= 70) streak++
    else break
  }

  // Best / worst subject
  const bySubject: Record<string, number[]> = {}
  for (const s of sessions) {
    if (!bySubject[s.subject]) bySubject[s.subject] = []
    bySubject[s.subject].push(pct(s))
  }
  const subjectAvgs = Object.entries(bySubject).map(([subject, vals]) => ({
    subject,
    avg: avg(vals),
    tests: vals.length,
    best: Math.max(...vals),
    worst: Math.min(...vals),
  }))
  subjectAvgs.sort((a, b) => b.avg - a.avg)

  const bestSubject = subjectAvgs[0] ?? null
  const worstSubject = subjectAvgs[subjectAvgs.length - 1] ?? null

  // Chart: last 10 tests in chronological order
  const chartData = [...sessions]
    .slice(0, 10)
    .reverse()
    .map(s => ({
      date: formatDate(s.started_at, true),
      pct: pct(s),
    }))

  // ── Render ─────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-surface-page px-4 py-10 sm:py-14">
      <div className="max-w-3xl mx-auto space-y-8">

        {/* ── Header ── */}
        <div>
          <h1 className="text-2xl font-bold text-ink-strong">Estadísticas</h1>
          <p className="text-ink-dim text-sm mt-0.5">Tu historial de tests</p>
        </div>

        {isEmpty ? (
          <div className="bg-surface-card rounded-2xl border border-wire p-12 text-center space-y-3">
            <p className="text-4xl">📊</p>
            <p className="text-ink-muted font-medium">Sin estadísticas todavía</p>
            <p className="text-ink-ghost text-sm">Completa tu primer test para ver tus resultados aquí.</p>
            <a
              href="/"
              className="inline-block mt-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition-colors"
            >
              Hacer un test
            </a>
          </div>
        ) : (
          <>
            {/* ── Summary cards ── */}
            <section>
              <h2 className="text-xs font-semibold text-ink-dim uppercase tracking-widest mb-4">
                Resumen general
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <SummaryCard
                  label="Tests realizados"
                  value={String(totalTests)}
                  sub="total"
                />
                <SummaryCard
                  label="Media global"
                  value={`${globalAvg}%`}
                  sub="de aciertos"
                  valueClass={scoreColor(globalAvg)}
                />
                <SummaryCard
                  label="Racha actual"
                  value={String(streak)}
                  sub={streak === 1 ? 'test ≥70%' : 'tests ≥70%'}
                  valueClass={streak >= 3 ? 'text-amber-500' : 'text-ink'}
                />
                <SummaryCard
                  label="Asignaturas"
                  value={String(subjectAvgs.length)}
                  sub="estudiadas"
                />
              </div>
            </section>

            {/* Best / worst subject */}
            {subjectAvgs.length >= 2 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <HighlightCard
                  label="Mejor asignatura"
                  subject={bestSubject!.subject}
                  value={`${bestSubject!.avg}%`}
                  icon="🏆"
                  color="border-green-500/30 bg-green-500/5"
                  valueClass="text-green-500"
                />
                <HighlightCard
                  label="A mejorar"
                  subject={worstSubject!.subject}
                  value={`${worstSubject!.avg}%`}
                  icon="📚"
                  color="border-orange-500/30 bg-orange-500/5"
                  valueClass="text-orange-500"
                />
              </div>
            )}

            {/* ── Evolution chart ── */}
            <section className="bg-surface-card rounded-2xl border border-wire p-5">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-sm font-semibold text-ink">Evolución reciente</h2>
                <span className="text-xs text-ink-ghost">últimos {chartData.length} tests</span>
              </div>
              <p className="text-xs text-ink-ghost mb-5">
                La línea punteada marca el 70% de aciertos
              </p>
              <ProgressChart data={chartData} />
            </section>

            {/* ── Per-subject stats ── */}
            {subjectAvgs.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-ink-dim uppercase tracking-widest mb-4">
                  Por asignatura
                </h2>
                <div className="bg-surface-card rounded-2xl border border-wire overflow-hidden">
                  {/* Table header (desktop) */}
                  <div className="hidden sm:grid sm:grid-cols-5 px-5 py-2.5 border-b border-wire text-xs font-medium text-ink-dim uppercase tracking-wider">
                    <span className="col-span-2">Asignatura</span>
                    <span className="text-right">Tests</span>
                    <span className="text-right">Media</span>
                    <span className="text-right">Mejor / Peor</span>
                  </div>

                  {subjectAvgs.map((row, i) => (
                    <div
                      key={row.subject}
                      className={`px-5 py-4 ${i < subjectAvgs.length - 1 ? 'border-b border-wire/60' : ''}`}
                    >
                      {/* Mobile layout */}
                      <div className="sm:hidden space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-ink-strong">{row.subject}</span>
                          <span className={scoreBadge(row.avg)}>{row.avg}%</span>
                        </div>
                        <div className="flex gap-4 text-xs text-ink-dim">
                          <span>{row.tests} tests</span>
                          <span>Mejor: <span className="text-green-500">{row.best}%</span></span>
                          <span>Peor: <span className="text-red-500">{row.worst}%</span></span>
                        </div>
                      </div>

                      {/* Desktop layout */}
                      <div className="hidden sm:grid sm:grid-cols-5 items-center text-sm">
                        <span className="col-span-2 font-medium text-ink-strong">{row.subject}</span>
                        <span className="text-right text-ink-faint">{row.tests}</span>
                        <span className={`text-right font-bold ${scoreColor(row.avg)}`}>
                          {row.avg}%
                        </span>
                        <span className="text-right text-xs text-ink-dim">
                          <span className="text-green-500">{row.best}%</span>
                          {' / '}
                          <span className="text-red-500">{row.worst}%</span>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── Hard questions ── */}
            {hardQuestions.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-ink-dim uppercase tracking-widest mb-4">
                  Preguntas difíciles
                </h2>
                <div className="bg-surface-card rounded-2xl border border-wire overflow-hidden">
                  {hardQuestions.map((q, i) => {
                    const hitPct = Math.round(((q.totalCount - q.wrongCount) / q.totalCount) * 100)
                    return (
                      <div
                        key={q.id}
                        className={`px-5 py-4 space-y-2 ${i < hardQuestions.length - 1 ? 'border-b border-wire/60' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <p className="text-sm text-ink-strong leading-snug flex-1">{q.statement}</p>
                          <span className={scoreBadge(hitPct)}>{hitPct}%</span>
                        </div>
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="text-xs px-2 py-0.5 bg-surface-input rounded-md text-ink-faint">
                            {q.subject}
                          </span>
                          <span className="text-xs text-ink-ghost">{q.topic}</span>
                          <span className="text-xs text-red-400 ml-auto tabular-nums">
                            fallada {q.wrongCount}/{q.totalCount} {q.totalCount === 1 ? 'vez' : 'veces'}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {/* ── History ── */}
            <SessionsHistory sessions={sessions} />
          </>
        )}
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  sub,
  valueClass = 'text-ink',
}: {
  label: string
  value: string
  sub: string
  valueClass?: string
}) {
  return (
    <div className="bg-surface-card rounded-2xl border border-wire p-4 space-y-1">
      <p className="text-xs text-ink-dim leading-tight">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${valueClass}`}>{value}</p>
      <p className="text-xs text-ink-ghost">{sub}</p>
    </div>
  )
}

function HighlightCard({
  label,
  subject,
  value,
  icon,
  color,
  valueClass,
}: {
  label: string
  subject: string
  value: string
  icon: string
  color: string
  valueClass: string
}) {
  return (
    <div className={`rounded-2xl border px-5 py-4 flex items-center justify-between gap-4 ${color}`}>
      <div className="space-y-0.5">
        <p className="text-xs text-ink-dim">{label}</p>
        <p className="text-sm font-semibold text-ink-strong">{subject}</p>
      </div>
      <div className="text-right space-y-0.5">
        <p className="text-2xl">{icon}</p>
        <p className={`text-lg font-bold tabular-nums ${valueClass}`}>{value}</p>
      </div>
    </div>
  )
}

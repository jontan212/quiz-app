'use client'

import { normalizeText } from '@/lib/normalize'

export type CompareQuestion = {
  statement: string
  options: Array<{ text: string; isCorrect: boolean }>
}

// ── Diff palabra a palabra para detectar "casi iguales" (p. ej. erratas) ──

function tokenize(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean)
}

// Normaliza una palabra para comparar: minúsculas y sin puntuación en los
// extremos (así "sí." == "sí", pero "conjutno" != "conjunto").
function normWord(w: string): string {
  return w.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
}

// Marca qué palabras de `a` NO forman parte de la subsecuencia común con `b`
// (las que cambian), respetando el orden mediante LCS.
function changedFlags(a: string[], b: string[]): boolean[] {
  const an = a.map(normWord)
  const bn = b.map(normWord)
  const m = an.length
  const n = bn.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = an[i] === bn[j]
        ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }
  const changed = new Array<boolean>(m).fill(true)
  let i = 0
  let j = 0
  while (i < m && j < n) {
    if (an[i] === bn[j]) { changed[i] = false; i++; j++ }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++
    else j++
  }
  return changed
}

type OptionDiff = { words: string[]; changed: boolean[]; changedCount: number }

// Compara la opción `text` con la candidata más parecida de `candidates`.
function bestDiff(text: string, candidates: string[]): OptionDiff {
  const words = tokenize(text)
  let best: OptionDiff = { words, changed: words.map(() => true), changedCount: words.length }
  let bestMatched = -1
  for (const cand of candidates) {
    const changed = changedFlags(words, tokenize(cand))
    const matched = changed.filter(c => !c).length
    if (matched > bestMatched) {
      bestMatched = matched
      best = { words, changed, changedCount: changed.filter(c => c).length }
    }
  }
  return best
}

// "Casi igual" = comparten casi todo y solo difieren 1–2 palabras.
function isNearMiss(diff: OptionDiff): boolean {
  return diff.changedCount > 0 && diff.changedCount <= 2 && diff.words.length >= 3
}

type Props = {
  level: 'exact' | 'conflict'
  incoming: CompareQuestion
  incomingLabel?: string
  existing: CompareQuestion[]
  onClose: () => void
}

export default function DuplicateCompareModal({
  level,
  incoming,
  incomingLabel = 'En el CSV',
  existing,
  onClose,
}: Props) {
  const isExact = level === 'exact'

  // ¿Hay alguna opción que solo difiere por una errata mínima?
  const incomingOptTexts = incoming.options.map(o => o.text)
  const incomingNormSet = new Set(incoming.options.map(o => normalizeText(o.text)))
  const hasNearMiss = !isExact && existing.some(q =>
    q.options.some(o =>
      !incomingNormSet.has(normalizeText(o.text)) &&
      isNearMiss(bestDiff(o.text, incomingOptTexts)),
    ),
  )

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-start justify-center z-50 px-4 py-10 overflow-y-auto"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-surface-card border border-wire rounded-2xl w-full max-w-3xl shadow-2xl my-auto">

        {/* Header */}
        <div className={`flex items-start justify-between gap-4 px-5 py-4 border-b ${
          isExact ? 'border-red-800/40' : 'border-orange-800/40'
        }`}>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                isExact
                  ? 'bg-red-900/40 border-red-700/50 text-red-400'
                  : 'bg-orange-900/40 border-orange-700/50 text-orange-400'
              }`}>
                {isExact ? 'Duplicado exacto' : 'Conflicto de respuestas'}
              </span>
            </div>
            <p className="text-xs text-ink-dim">
              {isExact
                ? 'Esta pregunta ya existe con las mismas opciones y la misma respuesta correcta.'
                : 'El enunciado ya existe pero con opciones de respuestas diferentes.'}
            </p>
            {hasNearMiss && (
              <p className="text-xs text-amber-400/90">
                ⚠ Diferencias mínimas resaltadas — puede tratarse de una errata.
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 text-ink-dim hover:text-ink-muted text-xl leading-none mt-0.5"
          >
            ✕
          </button>
        </div>

        {/* Comparison grid */}
        <div className="p-5">
          <div className={`grid gap-4 ${existing.length === 1 ? 'md:grid-cols-2' : 'grid-cols-1'}`}>

            {/* Incoming */}
            <QuestionCard
              label={incomingLabel}
              variant="incoming"
              question={incoming}
            />

            {/* Existing matches */}
            {existing.map((q, i) => (
              <QuestionCard
                key={i}
                label={existing.length > 1 ? `En base de datos (${i + 1})` : 'En base de datos'}
                variant="existing"
                question={q}
                highlightDiff={!isExact ? incoming : undefined}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function QuestionCard({
  label,
  variant,
  question,
  highlightDiff,
}: {
  label: string
  variant: 'incoming' | 'existing'
  question: CompareQuestion
  // When provided, options that differ from this reference are highlighted
  highlightDiff?: CompareQuestion
}) {
  const incomingTexts = highlightDiff
    ? new Set(highlightDiff.options.map(o => normalizeText(o.text)))
    : null
  const incomingOptTexts = highlightDiff ? highlightDiff.options.map(o => o.text) : []

  return (
    <div className={`rounded-xl border p-4 space-y-3 ${
      variant === 'incoming'
        ? 'border-blue-700/40 bg-blue-950/20'
        : 'border-wire/60 bg-surface-input/20'
    }`}>
      <p className={`text-xs font-semibold uppercase tracking-wide ${
        variant === 'incoming' ? 'text-blue-400' : 'text-ink-dim'
      }`}>
        {label}
      </p>

      <p className="text-sm text-ink-strong leading-relaxed">{question.statement}</p>

      <div className="flex flex-col gap-1.5">
        {question.options.map((opt, i) => {
          // Highlight option if its text doesn't appear in the incoming options
          const isDifferent = incomingTexts !== null && !incomingTexts.has(normalizeText(opt.text))
          const diff = isDifferent && incomingOptTexts.length > 0
            ? bestDiff(opt.text, incomingOptTexts)
            : null
          const almostEqual = diff !== null && isNearMiss(diff)
          return (
            <span
              key={i}
              className={`text-xs px-2.5 py-1.5 rounded-lg border ${
                opt.isCorrect
                  ? isDifferent
                    ? 'bg-orange-900/40 border-orange-700/50 text-orange-300'
                    : 'bg-green-900/40 border-green-700/50 text-green-300'
                  : isDifferent
                    ? 'bg-orange-950/30 border-orange-800/40 text-orange-400/70'
                    : 'bg-surface-input/60 border-wire/50 text-ink-faint'
              }`}
            >
              {opt.isCorrect ? '✓ ' : ''}
              {almostEqual && diff
                ? diff.words.map((w, wi) => (
                    <span key={wi}>
                      {wi > 0 ? ' ' : ''}
                      {diff.changed[wi]
                        ? <span className="rounded px-0.5 font-semibold text-red-200 bg-red-500/30 underline decoration-red-400/70">{w}</span>
                        : w}
                    </span>
                  ))
                : (opt.text || <em className="text-ink-ghost">vacío</em>)}
              {isDifferent && !almostEqual && <span className="ml-1 text-orange-500/60">←</span>}
              {almostEqual && (
                <span className="ml-1.5 text-[10px] font-medium text-amber-400/90 whitespace-nowrap">
                  ≈ casi igual
                </span>
              )}
            </span>
          )
        })}
      </div>
    </div>
  )
}

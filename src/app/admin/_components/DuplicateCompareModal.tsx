'use client'

export type CompareQuestion = {
  statement: string
  options: Array<{ text: string; isCorrect: boolean }>
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

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-start justify-center z-50 px-4 py-10 overflow-y-auto"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-3xl shadow-2xl my-auto">

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
            <p className="text-xs text-gray-500">
              {isExact
                ? 'Esta pregunta ya existe con las mismas opciones y la misma respuesta correcta.'
                : 'El enunciado ya existe pero con opciones de respuesta o respuesta correcta diferente.'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 text-gray-500 hover:text-gray-300 text-xl leading-none mt-0.5"
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
    ? new Set(highlightDiff.options.map(o => o.text.trim().toLowerCase()))
    : null

  return (
    <div className={`rounded-xl border p-4 space-y-3 ${
      variant === 'incoming'
        ? 'border-blue-700/40 bg-blue-950/20'
        : 'border-gray-700/60 bg-gray-800/20'
    }`}>
      <p className={`text-xs font-semibold uppercase tracking-wide ${
        variant === 'incoming' ? 'text-blue-400' : 'text-gray-500'
      }`}>
        {label}
      </p>

      <p className="text-sm text-white leading-relaxed">{question.statement}</p>

      <div className="flex flex-col gap-1.5">
        {question.options.map((opt, i) => {
          // Highlight option if its text doesn't appear in the incoming options
          const isDifferent = incomingTexts !== null && !incomingTexts.has(opt.text.trim().toLowerCase())
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
                    : 'bg-gray-800/60 border-gray-700/50 text-gray-400'
              }`}
            >
              {opt.isCorrect ? '✓ ' : ''}{opt.text || <em className="text-gray-600">vacío</em>}
              {isDifferent && <span className="ml-1 text-orange-500/60">←</span>}
            </span>
          )
        })}
      </div>
    </div>
  )
}

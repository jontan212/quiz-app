'use client'

import { useState, useTransition } from 'react'
import {
  importQuestions,
  checkDuplicateStatements,
  checkDuplicateDetails,
  type ImportRow,
  type ExistingQuestion,
} from '../actions'
import DuplicateCompareModal, { type CompareQuestion } from '@/app/admin/_components/DuplicateCompareModal'

const SAMPLE_CSV = `asignatura,tema,enunciado,opcion1,opcion2,opcion3,opcion4,correcta
Ejemplo,Tema 1,¿Cuál es la capital de España?,Madrid,Barcelona,Sevilla,Valencia,1
Ejemplo,Tema 1,¿Cuántos lados tiene un triángulo?,2,3,4,5,2
Ejemplo,Tema 2,¿Qué gas respiramos principalmente?,Oxígeno,Nitrógeno,Dióxido de carbono,2`

type DuplicateLevel = 'exact' | 'conflict' | null

type PreviewRow = ImportRow & {
  id: string
  rowNumber?: number
  parseError?: string
  duplicateLevel: DuplicateLevel
  existingMatches: ExistingQuestion[]
}

type DeleteBatch = PreviewRow[]

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

function parseCSV(text: string): PreviewRow[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  const rows: PreviewRow[] = []

  for (let li = 1; li < lines.length; li++) {
    const line = lines[li].trim()
    if (!line) continue

    const cols = splitCSVLine(line)
    const rowNumber = li + 1
    const numCols = cols.length

    if (numCols < 6) {
      rows.push({
        id: uid(), rowNumber,
        subject: '', topic: '', statement: '',
        options: [], correctIndex: 0,
        duplicateLevel: null, existingMatches: [],
        parseError: `Solo ${numCols} columnas (mínimo 6)`,
      })
      continue
    }

    const subject = cols[0].trim()
    const topic = cols[1].trim()
    const statement = cols[2].trim()
    const correctaRaw = cols[numCols - 1].trim()
    const optionCols = cols.slice(3, numCols - 1)
    const options = optionCols.map(o => o.trim()).filter(Boolean)

    if (!subject || !topic || !statement) {
      rows.push({
        id: uid(), rowNumber, subject, topic, statement,
        options, correctIndex: 0,
        duplicateLevel: null, existingMatches: [],
        parseError: 'Asignatura, tema o enunciado vacío',
      })
      continue
    }

    const correctaNum = parseInt(correctaRaw, 10)
    if (isNaN(correctaNum) || correctaNum < 1 || correctaNum > options.length) {
      rows.push({
        id: uid(), rowNumber, subject, topic, statement, options,
        correctIndex: 0,
        duplicateLevel: null, existingMatches: [],
        parseError: `Columna "correcta" inválida: "${correctaRaw}" (opciones: 1–${options.length})`,
      })
      continue
    }

    rows.push({
      id: uid(), rowNumber, subject, topic, statement, options,
      correctIndex: correctaNum - 1,
      duplicateLevel: null, existingMatches: [],
    })
  }

  return rows
}

function splitCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

function rowToCompareQuestion(row: PreviewRow): CompareQuestion {
  return {
    statement: row.statement,
    options: row.options.map((text, i) => ({ text, isCorrect: i === row.correctIndex })),
  }
}

// ── Badge ──────────────────────────────────────────────────────
function DupBadge({
  level,
  onClick,
}: {
  level: DuplicateLevel
  onClick: (e: React.MouseEvent) => void
}) {
  if (!level) return null
  const isExact = level === 'exact'
  return (
    <button
      onClick={onClick}
      title="Clic para comparar con la pregunta existente"
      className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full border font-medium cursor-pointer transition-opacity hover:opacity-80 ${
        isExact
          ? 'bg-red-900/40 border-red-700/50 text-red-400'
          : 'bg-orange-900/40 border-orange-700/50 text-orange-400'
      }`}
    >
      {isExact ? 'Duplicado exacto' : 'Conflicto'}
    </button>
  )
}

export default function ImportForm() {
  const [allRows, setAllRows] = useState<PreviewRow[]>([])
  const [hasLoaded, setHasLoaded] = useState(false)
  const [fileName, setFileName] = useState('')
  const [result, setResult] = useState<{ imported: number; errors: number } | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [undoStack, setUndoStack] = useState<DeleteBatch[]>([])

  // Inline editing
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<PreviewRow | null>(null)

  // New row form
  const [showNewForm, setShowNewForm] = useState(false)
  const [newStmt, setNewStmt] = useState('')
  const [newOpts, setNewOpts] = useState(['', ''])
  const [newCorrect, setNewCorrect] = useState(0)
  const [newSubject, setNewSubject] = useState('')
  const [newTopic, setNewTopic] = useState('')
  const [isCheckingNew, setIsCheckingNew] = useState(false)
  const [newIsDuplicate, setNewIsDuplicate] = useState(false)

  // Comparison modal
  const [compareRow, setCompareRow] = useState<PreviewRow | null>(null)

  // ── Derived ────────────────────────────────────────────────────
  const validRows = allRows.filter(r => !r.parseError)
  const invalidRows = allRows.filter(r => r.parseError)
  const exactCount = validRows.filter(r => r.duplicateLevel === 'exact').length
  const conflictCount = validRows.filter(r => r.duplicateLevel === 'conflict').length
  const flaggedCount = exactCount + conflictCount
  const toImportCount = validRows.length - flaggedCount
  const filteredValid = validRows.filter(r =>
    !searchQuery || r.statement.toLowerCase().includes(searchQuery.toLowerCase())
  )
  const allFilteredSelected =
    filteredValid.length > 0 && filteredValid.every(r => selected.has(r.id))

  // ── File loading ───────────────────────────────────────────────
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setResult(null)
    setImportError(null)
    setSelected(new Set())
    setUndoStack([])
    setSearchQuery('')
    setEditingId(null)
    setEditDraft(null)
    setShowNewForm(false)
    setCompareRow(null)

    const text = await file.text()
    const parsed = parseCSV(text)
    setAllRows(parsed)
    setHasLoaded(true)

    const validParsed = parsed.filter(r => !r.parseError)
    if (validParsed.length > 0) {
      setIsCheckingDuplicates(true)
      const { matches } = await checkDuplicateDetails(
        validParsed.map(r => ({ statement: r.statement, options: r.options, correctIndex: r.correctIndex })),
      )
      // Build lookup: statementLower → match
      const matchMap = new Map(matches.map(m => [m.statementLower, m]))

      setAllRows(prev =>
        prev.map(r => {
          if (r.parseError) return r
          const m = matchMap.get(r.statement.toLowerCase())
          return m
            ? { ...r, duplicateLevel: m.level, existingMatches: m.existing }
            : { ...r, duplicateLevel: null, existingMatches: [] }
        }),
      )
      setIsCheckingDuplicates(false)
    }
  }

  // ── Delete ─────────────────────────────────────────────────────
  function deleteRow(id: string) {
    const row = allRows.find(r => r.id === id)
    if (!row) return
    setAllRows(prev => prev.filter(r => r.id !== id))
    setSelected(prev => { const s = new Set(prev); s.delete(id); return s })
    setUndoStack(prev => [...prev.slice(-9), [row]])
  }

  function deleteSelected() {
    const toDelete = allRows.filter(r => selected.has(r.id))
    if (toDelete.length === 0) return
    setAllRows(prev => prev.filter(r => !selected.has(r.id)))
    setUndoStack(prev => [...prev.slice(-9), toDelete])
    setSelected(new Set())
  }

  function deleteAllFlagged() {
    const toDelete = allRows.filter(r => r.duplicateLevel !== null)
    if (toDelete.length === 0) return
    setAllRows(prev => prev.filter(r => r.duplicateLevel === null))
    setSelected(prev => {
      const s = new Set(prev)
      toDelete.forEach(r => s.delete(r.id))
      return s
    })
    setUndoStack(prev => [...prev.slice(-9), toDelete])
  }

  function undo() {
    const batch = undoStack[undoStack.length - 1]
    if (!batch) return
    setAllRows(prev => [...prev, ...batch])
    setUndoStack(prev => prev.slice(0, -1))
  }

  // ── Selection ──────────────────────────────────────────────────
  function toggleSelect(id: string) {
    setSelected(prev => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }

  function toggleSelectAll() {
    if (allFilteredSelected) {
      setSelected(prev => {
        const s = new Set(prev)
        filteredValid.forEach(r => s.delete(r.id))
        return s
      })
    } else {
      setSelected(prev => {
        const s = new Set(prev)
        filteredValid.forEach(r => s.add(r.id))
        return s
      })
    }
  }

  // ── Inline editing ─────────────────────────────────────────────
  function startEdit(row: PreviewRow) {
    setEditingId(row.id)
    setEditDraft({ ...row, options: [...row.options] })
  }

  function cancelEdit() {
    setEditingId(null)
    setEditDraft(null)
  }

  function saveEdit() {
    if (!editDraft) return
    setAllRows(prev => prev.map(r => (r.id === editDraft.id ? editDraft : r)))
    setEditingId(null)
    setEditDraft(null)
  }

  function updateDraftOption(i: number, value: string) {
    if (!editDraft) return
    const opts = [...editDraft.options]
    opts[i] = value
    setEditDraft({ ...editDraft, options: opts })
  }

  function addDraftOption() {
    if (!editDraft) return
    setEditDraft({ ...editDraft, options: [...editDraft.options, ''] })
  }

  function removeDraftOption(i: number) {
    if (!editDraft || editDraft.options.length <= 2) return
    const opts = editDraft.options.filter((_, idx) => idx !== i)
    const newCorrectIndex =
      editDraft.correctIndex >= i
        ? Math.max(0, editDraft.correctIndex - 1)
        : editDraft.correctIndex
    setEditDraft({ ...editDraft, options: opts, correctIndex: newCorrectIndex })
  }

  // ── New row form ───────────────────────────────────────────────
  function resetNewForm() {
    setNewStmt(''); setNewOpts(['', '']); setNewCorrect(0)
    setNewSubject(''); setNewTopic('')
    setNewIsDuplicate(false); setIsCheckingNew(false)
  }

  async function handleNewStmtBlur() {
    if (!newStmt.trim()) return
    setIsCheckingNew(true)
    const { duplicates } = await checkDuplicateStatements([newStmt.trim()])
    setNewIsDuplicate(duplicates.length > 0)
    setIsCheckingNew(false)
  }

  function confirmNewRow() {
    const trimStmt = newStmt.trim()
    const trimSubject = newSubject.trim()
    const trimTopic = newTopic.trim()
    const opts = newOpts.map(o => o.trim()).filter(Boolean)
    if (!trimStmt || !trimSubject || !trimTopic || opts.length < 2 || newCorrect >= opts.length) return

    const newRow: PreviewRow = {
      id: uid(),
      subject: trimSubject,
      topic: trimTopic,
      statement: trimStmt,
      options: opts,
      correctIndex: newCorrect,
      duplicateLevel: newIsDuplicate ? 'conflict' : null,
      existingMatches: [],
    }
    setAllRows(prev => [...prev, newRow])
    setShowNewForm(false)
    resetNewForm()
  }

  // ── Import ─────────────────────────────────────────────────────
  function handleImport() {
    if (validRows.length === 0) return
    startTransition(async () => {
      const res = await importQuestions(
        validRows.map(({ subject, topic, statement, options, correctIndex }) => ({
          subject, topic, statement, options, correctIndex,
        })),
      )
      if (res.error) {
        setImportError(res.error)
      } else {
        setResult(res)
        setAllRows([])
        setHasLoaded(false)
        setFileName('')
        setSelected(new Set())
        setUndoStack([])
        setCompareRow(null)
      }
    })
  }

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">

      {/* Sample download */}
      <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-white">Formato del CSV</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              8 columnas — opcion3 y opcion4 son opcionales; la primera fila es la cabecera.
            </p>
          </div>
          <a
            href={`data:text/csv;charset=utf-8,${encodeURIComponent(SAMPLE_CSV)}`}
            download="ejemplo-preguntas.csv"
            className="flex-shrink-0 text-xs px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-600/40 text-blue-400 rounded-lg transition-colors font-medium"
          >
            Descargar ejemplo
          </a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="text-gray-500 border-b border-gray-800">
                {['asignatura','tema','enunciado','opcion1','opcion2','opcion3*','opcion4*','correcta'].map(h => (
                  <th key={h} className="px-2 py-1.5 text-left font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="text-gray-400">
              <tr>
                <td className="px-2 py-1">Ejemplo</td>
                <td className="px-2 py-1">Tema 1</td>
                <td className="px-2 py-1 max-w-[180px] truncate">¿Capital de España?</td>
                <td className="px-2 py-1">Madrid</td>
                <td className="px-2 py-1">Barcelona</td>
                <td className="px-2 py-1 text-gray-600">Sevilla</td>
                <td className="px-2 py-1 text-gray-600">Valencia</td>
                <td className="px-2 py-1 text-green-500">1</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-600">* Columnas opcionales. Si no hay opcion3/opcion4, omitirlas (no dejar vacías).</p>
      </div>

      {/* File input */}
      <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800 space-y-3">
        <h2 className="text-sm font-semibold text-white">Seleccionar archivo</h2>
        <label className="flex items-center gap-4 cursor-pointer group">
          <span className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 group-hover:bg-gray-700 border border-gray-700 text-gray-300 text-sm font-medium rounded-xl transition-colors">
            Elegir CSV…
          </span>
          <span className="text-sm text-gray-500 truncate">
            {fileName || 'Ningún archivo seleccionado'}
          </span>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={handleFile}
            className="sr-only"
          />
        </label>
      </div>

      {/* Result banner */}
      {result && (
        <div className={`px-4 py-3 rounded-xl border text-sm font-medium ${
          result.errors > 0
            ? 'bg-amber-900/30 border-amber-700/50 text-amber-300'
            : 'bg-green-900/30 border-green-700/50 text-green-300'
        }`}>
          {result.imported > 0 && `✓ ${result.imported} pregunta${result.imported !== 1 ? 's' : ''} importada${result.imported !== 1 ? 's' : ''} correctamente.`}
          {result.errors > 0 && ` ${result.errors} fila${result.errors !== 1 ? 's' : ''} con error.`}
        </div>
      )}

      {importError && (
        <div className="px-4 py-3 rounded-xl border bg-red-900/30 border-red-700/50 text-red-300 text-sm">
          Error: {importError}
        </div>
      )}

      {/* Preview */}
      {hasLoaded && (
        <div className="space-y-4">

          {/* Summary bar */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="text-sm text-gray-400">
              <span className="text-white font-semibold">{validRows.length}</span> totales
              {isCheckingDuplicates
                ? <span className="text-gray-500"> · comprobando duplicados…</span>
                : (
                  <>
                    {exactCount > 0 && (
                      <> · <span className="text-red-400 font-semibold">{exactCount}</span> exactos</>
                    )}
                    {conflictCount > 0 && (
                      <> · <span className="text-orange-400 font-semibold">{conflictCount}</span> conflictos</>
                    )}
                  </>
                )
              }
              {invalidRows.length > 0 && (
                <> · <span className="text-gray-500 font-semibold">{invalidRows.length}</span> con error</>
              )}
              {' · '}
              <span className="text-blue-400 font-semibold">{toImportCount}</span> a importar
            </span>
            <button
              onClick={() => { setShowNewForm(v => !v); if (showNewForm) resetNewForm() }}
              className="text-sm px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-600/40 text-blue-400 rounded-lg transition-colors font-medium"
            >
              + Añadir pregunta
            </button>
          </div>

          {/* New row form */}
          {showNewForm && (
            <div className="bg-gray-900 border border-blue-800/50 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-blue-400 uppercase tracking-wide">Nueva pregunta</p>

              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Asignatura"
                  value={newSubject}
                  onChange={e => setNewSubject(e.target.value)}
                  className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <input
                  type="text"
                  placeholder="Tema"
                  value={newTopic}
                  onChange={e => setNewTopic(e.target.value)}
                  className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <textarea
                  placeholder="Enunciado de la pregunta…"
                  value={newStmt}
                  onChange={e => { setNewStmt(e.target.value); setNewIsDuplicate(false) }}
                  onBlur={handleNewStmtBlur}
                  rows={2}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                />
                {isCheckingNew && <p className="text-xs text-gray-500 mt-1">Comprobando duplicado…</p>}
                {!isCheckingNew && newIsDuplicate && (
                  <p className="text-xs text-amber-400 mt-1">
                    ⚠ Ya existe una pregunta con este enunciado.
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                {newOpts.map((opt, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
                      newCorrect === i ? 'bg-green-950/40 border-green-800' : 'bg-gray-800 border-gray-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="new-correct"
                      checked={newCorrect === i}
                      onChange={() => setNewCorrect(i)}
                      className="accent-green-500 flex-shrink-0"
                    />
                    <input
                      type="text"
                      placeholder={`Opción ${i + 1}`}
                      value={opt}
                      onChange={e => {
                        const o = [...newOpts]
                        o[i] = e.target.value
                        setNewOpts(o)
                      }}
                      className="flex-1 bg-transparent text-white text-sm placeholder-gray-500 focus:outline-none"
                    />
                    {newOpts.length > 2 && (
                      <button
                        type="button"
                        onClick={() => {
                          const o = newOpts.filter((_, idx) => idx !== i)
                          setNewOpts(o)
                          if (newCorrect >= i && newCorrect > 0) setNewCorrect(newCorrect - 1)
                        }}
                        className="text-gray-600 hover:text-red-400 text-lg leading-none"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setNewOpts(o => [...o, ''])}
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  + Añadir opción
                </button>
              </div>

              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => { setShowNewForm(false); resetNewForm() }}
                  className="px-3 py-1.5 text-sm text-gray-400 hover:text-gray-200"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmNewRow}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Añadir
                </button>
              </div>
            </div>
          )}

          {/* Invalid rows */}
          {invalidRows.length > 0 && (
            <div className="bg-red-950/30 border border-red-800/50 rounded-xl p-4 space-y-2">
              <p className="text-xs font-semibold text-red-400 uppercase tracking-wide">Filas con error (se omitirán)</p>
              {invalidRows.map(r => (
                <div key={r.id} className="text-xs text-red-300 flex gap-2">
                  <span className="text-red-500 font-mono flex-shrink-0">Fila {r.rowNumber}:</span>
                  <span>{r.parseError}</span>
                </div>
              ))}
            </div>
          )}

          {/* Toolbar */}
          {validRows.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="text"
                placeholder="Buscar por enunciado…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="flex-1 min-w-[200px] px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {selected.size > 0 && (
                <button
                  onClick={deleteSelected}
                  className="px-3 py-2 bg-red-900/40 hover:bg-red-900/60 border border-red-800/50 text-red-400 text-sm rounded-lg transition-colors whitespace-nowrap"
                >
                  Eliminar {selected.size} sel.
                </button>
              )}
              {flaggedCount > 0 && (
                <button
                  onClick={deleteAllFlagged}
                  className="px-3 py-2 bg-orange-900/30 hover:bg-orange-900/50 border border-orange-800/50 text-orange-400 text-sm rounded-lg transition-colors whitespace-nowrap"
                >
                  Eliminar duplicadas ({flaggedCount})
                </button>
              )}
              {undoStack.length > 0 && (
                <button
                  onClick={undo}
                  className="px-3 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 text-sm rounded-lg transition-colors whitespace-nowrap"
                >
                  ↩ Deshacer
                </button>
              )}
            </div>
          )}

          {/* Valid rows list */}
          {filteredValid.length > 0 && (
            <div className="divide-y divide-gray-800/60 pb-28">
              {/* Select-all row */}
              <div className="py-2 flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 accent-blue-500 cursor-pointer flex-shrink-0"
                />
                <span className="text-xs text-gray-500">
                  {selected.size > 0
                    ? `${selected.size} seleccionada${selected.size !== 1 ? 's' : ''}`
                    : 'Seleccionar todo'}
                </span>
              </div>

              {filteredValid.map((row, i) => (
                <div key={row.id} className="py-3">
                  {editingId === row.id && editDraft ? (
                    /* Edit mode */
                    <div className="space-y-3 bg-gray-900 border border-blue-800/50 rounded-xl p-4">
                      <textarea
                        value={editDraft.statement}
                        onChange={e => setEditDraft({ ...editDraft, statement: e.target.value })}
                        rows={2}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                      />
                      <div className="space-y-1.5">
                        {editDraft.options.map((opt, oi) => (
                          <div
                            key={oi}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
                              editDraft.correctIndex === oi
                                ? 'bg-green-950/40 border-green-800'
                                : 'bg-gray-800 border-gray-700'
                            }`}
                          >
                            <input
                              type="radio"
                              name={`edit-correct-${row.id}`}
                              checked={editDraft.correctIndex === oi}
                              onChange={() => setEditDraft({ ...editDraft, correctIndex: oi })}
                              className="accent-green-500 flex-shrink-0"
                            />
                            <input
                              type="text"
                              value={opt}
                              onChange={e => updateDraftOption(oi, e.target.value)}
                              className="flex-1 bg-transparent text-white text-sm focus:outline-none"
                            />
                            {editDraft.options.length > 2 && (
                              <button
                                type="button"
                                onClick={() => removeDraftOption(oi)}
                                className="text-gray-600 hover:text-red-400 text-lg leading-none"
                              >
                                ×
                              </button>
                            )}
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={addDraftOption}
                          className="text-xs text-blue-400 hover:text-blue-300"
                        >
                          + Añadir opción
                        </button>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={cancelEdit}
                          className="px-3 py-1.5 text-sm text-gray-400 hover:text-gray-200"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={saveEdit}
                          className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
                        >
                          Guardar
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* View mode */
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selected.has(row.id)}
                        onChange={() => toggleSelect(row.id)}
                        className="w-4 h-4 accent-blue-500 cursor-pointer flex-shrink-0 mt-1"
                      />
                      <span className="text-xs text-gray-600 tabular-nums w-5 flex-shrink-0 mt-1">
                        {i + 1}.
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-xs px-2 py-0.5 bg-gray-800 text-gray-400 rounded-full truncate max-w-[35%]">
                            {row.subject}
                          </span>
                          <span className="text-xs text-gray-600 truncate max-w-[35%]">{row.topic}</span>
                          <DupBadge
                            level={row.duplicateLevel}
                            onClick={e => { e.stopPropagation(); setCompareRow(row) }}
                          />
                        </div>
                        <p className="text-sm text-white leading-snug">{row.statement}</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {row.options.map((opt, oi) => (
                            <span
                              key={oi}
                              className={`text-xs px-2 py-1 rounded-lg ${
                                oi === row.correctIndex
                                  ? 'bg-green-900/40 border border-green-700/50 text-green-300'
                                  : 'bg-gray-800 text-gray-400'
                              }`}
                            >
                              {oi === row.correctIndex ? '✓ ' : ''}{opt}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => startEdit(row)}
                          title="Editar"
                          className="p-1.5 text-gray-500 hover:text-blue-400 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => deleteRow(row.id)}
                          title="Eliminar"
                          className="p-1.5 text-gray-500 hover:text-red-400 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {filteredValid.length === 0 && validRows.length > 0 && searchQuery && (
            <p className="text-center text-gray-500 text-sm py-4">
              No hay preguntas que coincidan con la búsqueda.
            </p>
          )}

          {/* Import button — fixed at bottom */}
          {validRows.length > 0 && (
            <div className="fixed bottom-0 inset-x-0 z-50 p-4 bg-gray-950/95 border-t border-gray-800 backdrop-blur-sm">
              <div className="max-w-4xl mx-auto">
                <button
                  onClick={handleImport}
                  disabled={isPending}
                  className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors shadow-lg shadow-blue-900/30 text-sm"
                >
                  {isPending
                    ? 'Importando…'
                    : `Importar ${validRows.length} pregunta${validRows.length !== 1 ? 's' : ''}`}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {hasLoaded && allRows.length === 0 && (
        <p className="text-center text-gray-500 text-sm py-4">
          El archivo no contiene filas de datos (solo cabecera o vacío).
        </p>
      )}

      {/* Comparison modal */}
      {compareRow && compareRow.existingMatches.length > 0 && compareRow.duplicateLevel && (
        <DuplicateCompareModal
          level={compareRow.duplicateLevel}
          incomingLabel="En el CSV"
          incoming={rowToCompareQuestion(compareRow)}
          existing={compareRow.existingMatches.map(m => ({
            statement: m.statement,
            options: m.options,
          }))}
          onClose={() => setCompareRow(null)}
        />
      )}
    </div>
  )
}

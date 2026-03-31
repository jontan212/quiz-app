'use client'

import { Fragment, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteQuestion, deleteManyQuestions } from '../actions'
import type { QuestionWithOptions } from '@/lib/types'
import DuplicateCompareModal, { type CompareQuestion } from '@/app/admin/_components/DuplicateCompareModal'

type SortField = 'created_at' | 'subject' | 'topic'
type SortDir = 'asc' | 'desc'

const PAGE_SIZES = [10, 20, 30, 50, 100]

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-ES', {
    day: '2-digit', month: '2-digit', year: '2-digit',
  })
}

function escapeCsv(v: string) {
  return `"${v.replace(/"/g, '""')}"`
}

export default function QuestionsManager({ questions }: { questions: QuestionWithOptions[] }) {
  const router = useRouter()

  // ── Filter state ─────────────────────────────────────────────
  const [search, setSearch] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [subjectFilter, setSubjectFilter] = useState('')
  const [topicFilter, setTopicFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [onlyDuplicates, setOnlyDuplicates] = useState(false)

  // ── Sort state ───────────────────────────────────────────────
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  // ── Pagination ───────────────────────────────────────────────
  const [pageSize, setPageSize] = useState(30)
  const [page, setPage] = useState(1)

  // ── Selection & UI ───────────────────────────────────────────
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)
  const [confirmSingleId, setConfirmSingleId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // ── Two-level duplicate map  (id → { level, matches }) ──────
  type DupInfo = { level: 'exact' | 'conflict'; matches: QuestionWithOptions[] }

  const dupMap = useMemo<Map<string, DupInfo>>(() => {
    function sortedTexts(texts: string[]) {
      return texts.map(t => t.trim().toLowerCase()).sort().join('\0')
    }
    function qOptsKey(q: QuestionWithOptions) {
      return sortedTexts(q.question_options.map(o => o.text ?? ''))
    }
    function qCorrectKey(q: QuestionWithOptions) {
      return sortedTexts(q.question_options.filter(o => o.is_correct).map(o => o.text ?? ''))
    }

    // Group by lowercased statement
    const byStmt = new Map<string, QuestionWithOptions[]>()
    for (const q of questions) {
      const k = q.statement.toLowerCase()
      const arr = byStmt.get(k) ?? []
      arr.push(q)
      byStmt.set(k, arr)
    }

    const map = new Map<string, DupInfo>()
    for (const [, group] of byStmt) {
      if (group.length < 2) continue
      for (const q of group) {
        const others = group.filter(x => x.id !== q.id)
        let level: 'exact' | 'conflict' = 'exact'
        for (const other of others) {
          if (qOptsKey(q) !== qOptsKey(other) || qCorrectKey(q) !== qCorrectKey(other)) {
            level = 'conflict'; break
          }
        }
        map.set(q.id, { level, matches: others })
      }
    }
    return map
  }, [questions])

  // Comparison modal state
  const [comparingQId, setComparingQId] = useState<string | null>(null)

  // ── Filter option lists ──────────────────────────────────────
  const subjects = useMemo(
    () => [...new Set(questions.map(q => q.subject))].sort(),
    [questions],
  )
  const topics = useMemo(
    () => [...new Set(
      questions
        .filter(q => !subjectFilter || q.subject === subjectFilter)
        .map(q => q.topic),
    )].sort(),
    [questions, subjectFilter],
  )

  // ── Filtered + sorted list ───────────────────────────────────
  const filtered = useMemo(() => {
    let list = questions

    if (search) {
      const needle = caseSensitive ? search : search.toLowerCase()
      list = list.filter(q => {
        const hay = caseSensitive ? q.statement : q.statement.toLowerCase()
        return hay.includes(needle)
      })
    }
    if (subjectFilter) list = list.filter(q => q.subject === subjectFilter)
    if (topicFilter) list = list.filter(q => q.topic === topicFilter)
    if (dateFrom) {
      const from = new Date(dateFrom)
      list = list.filter(q => new Date(q.created_at) >= from)
    }
    if (dateTo) {
      const to = new Date(dateTo + 'T23:59:59.999')
      list = list.filter(q => new Date(q.created_at) <= to)
    }
    if (onlyDuplicates) {
      list = list.filter(q => dupMap.has(q.id))
    }

    const dir = sortDir === 'asc' ? 1 : -1
    return [...list].sort((a, b) => {
      const va = a[sortField] ?? ''
      const vb = b[sortField] ?? ''
      return va < vb ? -dir : va > vb ? dir : 0
    })
  }, [questions, search, caseSensitive, subjectFilter, topicFilter, dateFrom, dateTo, onlyDuplicates, sortField, sortDir, dupMap])

  // ── Pagination ───────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.max(1, Math.min(page, totalPages))
  const pageStart = (safePage - 1) * pageSize
  const pageItems = filtered.slice(pageStart, pageStart + pageSize)
  const allPageSelected = pageItems.length > 0 && pageItems.every(q => selected.has(q.id))

  // ── Filter setters (reset page on each change) ───────────────
  function changeSearch(v: string) { setSearch(v); setPage(1) }
  function changeCaseSensitive() { setCaseSensitive(v => !v); setPage(1) }
  function changeSubject(v: string) { setSubjectFilter(v); setTopicFilter(''); setPage(1) }
  function changeTopic(v: string) { setTopicFilter(v); setPage(1) }
  function changeDateFrom(v: string) { setDateFrom(v); setPage(1) }
  function changeDateTo(v: string) { setDateTo(v); setPage(1) }
  function changeOnlyDuplicates() { setOnlyDuplicates(v => !v); setPage(1) }
  function clearFilters() {
    setSearch(''); setCaseSensitive(false); setSubjectFilter(''); setTopicFilter('')
    setDateFrom(''); setDateTo(''); setOnlyDuplicates(false); setPage(1)
  }
  const hasFilters = !!(search || subjectFilter || topicFilter || dateFrom || dateTo || onlyDuplicates)

  // ── Sort ─────────────────────────────────────────────────────
  function handleSort(field: SortField) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
    setPage(1)
  }

  function sortIcon(field: SortField) {
    if (sortField !== field) return <span className="ml-0.5 text-gray-700">↕</span>
    return <span className="ml-0.5 text-blue-400">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  // ── Selection ────────────────────────────────────────────────
  function toggleSelect(id: string) {
    setSelected(prev => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }

  function toggleSelectPage() {
    if (allPageSelected) {
      setSelected(prev => {
        const s = new Set(prev)
        pageItems.forEach(q => s.delete(q.id))
        return s
      })
    } else {
      setSelected(prev => {
        const s = new Set(prev)
        pageItems.forEach(q => s.add(q.id))
        return s
      })
    }
  }

  // ── Delete ───────────────────────────────────────────────────
  function handleDeleteSingle(id: string) {
    setDeleteError(null)
    startTransition(async () => {
      const res = await deleteQuestion(id)
      if (res.error) {
        setDeleteError(res.error)
      } else {
        setSelected(prev => { const s = new Set(prev); s.delete(id); return s })
        router.refresh()
      }
      setConfirmSingleId(null)
    })
  }

  function handleDeleteBulk() {
    setDeleteError(null)
    startTransition(async () => {
      const res = await deleteManyQuestions([...selected])
      if (res.error) {
        setDeleteError(res.error)
      } else {
        setSelected(new Set())
        router.refresh()
      }
      setConfirmBulkDelete(false)
    })
  }

  // ── Export CSV ───────────────────────────────────────────────
  function exportCSV() {
    const toExport = questions.filter(q => selected.has(q.id))
    if (toExport.length === 0) return
    const header = 'asignatura,tema,enunciado,opcion1,opcion2,opcion3,opcion4,correcta,explicacion,fecha'
    const rows = toExport.map(q => {
      const opts = [...q.question_options].sort((a, b) => a.position - b.position)
      const correctIdx = opts.findIndex(o => o.is_correct) + 1
      return [
        escapeCsv(q.subject),
        escapeCsv(q.topic),
        escapeCsv(q.statement),
        escapeCsv(opts[0]?.text ?? ''),
        escapeCsv(opts[1]?.text ?? ''),
        escapeCsv(opts[2]?.text ?? ''),
        escapeCsv(opts[3]?.text ?? ''),
        String(correctIdx),
        escapeCsv(q.explanation ?? ''),
        escapeCsv(q.created_at.slice(0, 10)),
      ].join(',')
    })
    const csv = [header, ...rows].join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'preguntas-exportadas.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Pagination page list ─────────────────────────────────────
  function pageList(): (number | '...')[] {
    const delta = 2
    const pages: (number | '...')[] = []
    const left = Math.max(1, safePage - delta)
    const right = Math.min(totalPages, safePage + delta)
    if (left > 1) { pages.push(1); if (left > 2) pages.push('...') }
    for (let i = left; i <= right; i++) pages.push(i)
    if (right < totalPages) { if (right < totalPages - 1) pages.push('...'); pages.push(totalPages) }
    return pages
  }

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-950 py-8 px-4">
      <div className="max-w-6xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Gestionar preguntas</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              {filtered.length !== questions.length
                ? `${filtered.length} de ${questions.length} preguntas`
                : `${questions.length} preguntas`}
            </p>
          </div>
          <a href="/admin" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
            ← Admin
          </a>
        </div>

        {/* Filters */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-4 space-y-3">
          {/* Search */}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Buscar por enunciado…"
              value={search}
              onChange={e => changeSearch(e.target.value)}
              className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              onClick={changeCaseSensitive}
              title={caseSensitive ? 'Búsqueda sensible a mayúsculas (activa)' : 'Búsqueda insensible a mayúsculas (activa)'}
              className={`px-3 py-2 rounded-lg border text-xs font-mono font-semibold transition-colors ${
                caseSensitive
                  ? 'bg-blue-600/20 border-blue-600/50 text-blue-400'
                  : 'bg-gray-800 border-gray-700 text-gray-500 hover:text-gray-300'
              }`}
            >
              Aa
            </button>
          </div>

          {/* Other filters */}
          <div className="flex flex-wrap gap-2 items-center">
            <select
              value={subjectFilter}
              onChange={e => changeSubject(e.target.value)}
              className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Todas las asignaturas</option>
              {subjects.map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            <select
              value={topicFilter}
              onChange={e => changeTopic(e.target.value)}
              disabled={topics.length === 0}
              className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
            >
              <option value="">Todos los temas</option>
              {topics.map(t => <option key={t} value={t}>{t}</option>)}
            </select>

            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-600">Desde</span>
              <input
                type="date"
                value={dateFrom}
                onChange={e => changeDateFrom(e.target.value)}
                className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <span className="text-xs text-gray-600">hasta</span>
              <input
                type="date"
                value={dateTo}
                onChange={e => changeDateTo(e.target.value)}
                className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <button
              onClick={changeOnlyDuplicates}
              className={`px-3 py-2 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap ${
                onlyDuplicates
                  ? 'bg-amber-900/40 border-amber-700/50 text-amber-400'
                  : 'bg-gray-800 border-gray-700 text-gray-500 hover:text-gray-300'
              }`}
            >
              Solo duplicadas
              {dupMap.size > 0 && (
                <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${
                  onlyDuplicates ? 'bg-amber-700/40 text-amber-300' : 'bg-gray-700 text-gray-400'
                }`}>
                  {dupMap.size}
                </span>
              )}
            </button>

            {hasFilters && (
              <button
                onClick={clearFilters}
                className="px-3 py-2 text-xs text-gray-500 hover:text-gray-300 transition-colors underline"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        </div>

        {/* Bulk action bar */}
        {selected.size > 0 && (
          <div className="flex items-center gap-3 px-4 py-3 bg-blue-950/40 border border-blue-800/50 rounded-xl">
            <span className="text-sm text-blue-300 font-medium flex-1">
              {selected.size} pregunta{selected.size !== 1 ? 's' : ''} seleccionada{selected.size !== 1 ? 's' : ''}
            </span>
            <button
              onClick={exportCSV}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 text-xs rounded-lg transition-colors"
            >
              Exportar CSV
            </button>
            <button
              onClick={() => setConfirmBulkDelete(true)}
              className="px-3 py-1.5 bg-red-900/40 hover:bg-red-900/60 border border-red-800/50 text-red-400 text-xs rounded-lg transition-colors"
            >
              Eliminar seleccionadas
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="text-gray-500 hover:text-gray-300 text-lg leading-none"
            >
              ✕
            </button>
          </div>
        )}

        {/* Error */}
        {deleteError && (
          <div className="px-4 py-3 bg-red-950/60 border border-red-800 rounded-lg text-red-300 text-sm">
            Error al eliminar: {deleteError}
          </div>
        )}

        {/* Table card */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">

          {/* Table toolbar */}
          <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-gray-800">
            <span className="text-xs text-gray-500">
              {filtered.length === 0
                ? 'Sin resultados'
                : `Mostrando ${pageStart + 1}–${Math.min(pageStart + pageSize, filtered.length)} de ${filtered.length}`}
            </span>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-600">Por página:</label>
              <select
                value={pageSize}
                onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }}
                className="px-2 py-1 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-200 focus:outline-none"
              >
                {PAGE_SIZES.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-gray-500 text-sm">No hay preguntas con los filtros seleccionados.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-left">
                    <th className="w-10 px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={allPageSelected}
                        onChange={toggleSelectPage}
                        className="w-4 h-4 accent-blue-500 cursor-pointer"
                      />
                    </th>
                    <th className="w-8 px-2 py-2.5 text-xs text-gray-600 font-medium">#</th>
                    <th className="px-3 py-2.5 text-xs text-gray-500 font-medium uppercase tracking-wide">
                      Enunciado
                    </th>
                    <th className="px-3 py-2.5">
                      <button
                        onClick={() => handleSort('subject')}
                        className={`flex items-center text-xs font-medium uppercase tracking-wide whitespace-nowrap transition-colors ${
                          sortField === 'subject' ? 'text-blue-400' : 'text-gray-500 hover:text-gray-300'
                        }`}
                      >
                        Asignatura {sortIcon('subject')}
                      </button>
                    </th>
                    <th className="px-3 py-2.5">
                      <button
                        onClick={() => handleSort('topic')}
                        className={`flex items-center text-xs font-medium uppercase tracking-wide whitespace-nowrap transition-colors ${
                          sortField === 'topic' ? 'text-blue-400' : 'text-gray-500 hover:text-gray-300'
                        }`}
                      >
                        Tema {sortIcon('topic')}
                      </button>
                    </th>
                    <th className="px-3 py-2.5">
                      <button
                        onClick={() => handleSort('created_at')}
                        className={`flex items-center text-xs font-medium uppercase tracking-wide whitespace-nowrap transition-colors ${
                          sortField === 'created_at' ? 'text-blue-400' : 'text-gray-500 hover:text-gray-300'
                        }`}
                      >
                        Fecha {sortIcon('created_at')}
                      </button>
                    </th>
                    <th className="px-3 py-2.5 text-xs text-gray-500 font-medium uppercase tracking-wide text-right">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((q, i) => {
                    const dupInfo = dupMap.get(q.id)
                    const isExpanded = expandedIds.has(q.id)
                    const opts = [...q.question_options].sort((a, b) => a.position - b.position)
                    return (
                      <Fragment key={q.id}>
                        <tr
                          onClick={() => setExpandedIds(prev => {
                              const s = new Set(prev)
                              s.has(q.id) ? s.delete(q.id) : s.add(q.id)
                              return s
                            })}
                          className={`border-b border-gray-800/50 cursor-pointer transition-colors ${
                            isExpanded
                              ? 'bg-gray-800/50'
                              : selected.has(q.id)
                                ? 'bg-blue-950/20 hover:bg-blue-950/30'
                                : 'hover:bg-gray-800/30'
                          }`}
                        >
                          {/* Checkbox */}
                          <td
                            className="px-3 py-2.5"
                            onClick={e => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              checked={selected.has(q.id)}
                              onChange={() => toggleSelect(q.id)}
                              className="w-4 h-4 accent-blue-500 cursor-pointer"
                            />
                          </td>

                          {/* Row number */}
                          <td className="px-2 py-2.5 text-xs text-gray-600 tabular-nums">
                            {pageStart + i + 1}
                          </td>

                          {/* Statement */}
                          <td className="px-3 py-2.5 max-w-xs lg:max-w-md">
                            <div className="flex items-start gap-2">
                              <span className="text-white text-sm leading-snug line-clamp-2 min-w-0">
                                {q.statement}
                              </span>
                              {dupInfo && (
                                <button
                                  onClick={e => { e.stopPropagation(); setComparingQId(q.id) }}
                                  title="Clic para comparar con coincidencias"
                                  className={`flex-shrink-0 text-xs px-1.5 py-0.5 rounded-full border font-medium cursor-pointer transition-opacity hover:opacity-80 ${
                                    dupInfo.level === 'exact'
                                      ? 'bg-red-900/40 border-red-700/50 text-red-400'
                                      : 'bg-orange-900/40 border-orange-700/50 text-orange-400'
                                  }`}
                                >
                                  {dupInfo.level === 'exact' ? 'Exacto' : 'Conflicto'}
                                </button>
                              )}
                            </div>
                          </td>

                          {/* Subject */}
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <span className="text-xs px-2 py-0.5 bg-blue-900/30 text-blue-400 rounded-md">
                              {q.subject}
                            </span>
                          </td>

                          {/* Topic */}
                          <td className="px-3 py-2.5 text-xs text-gray-400 whitespace-nowrap">
                            {q.topic}
                          </td>

                          {/* Date */}
                          <td className="px-3 py-2.5 text-xs text-gray-500 whitespace-nowrap tabular-nums">
                            {fmtDate(q.created_at)}
                          </td>

                          {/* Actions */}
                          <td
                            className="px-3 py-2.5"
                            onClick={e => e.stopPropagation()}
                          >
                            <div className="flex items-center gap-1.5 justify-end">
                              <a
                                href={`/admin/questions/${q.id}/edit`}
                                className="px-2.5 py-1 text-xs font-medium bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors"
                              >
                                Editar
                              </a>
                              {confirmSingleId === q.id ? (
                                <>
                                  <button
                                    onClick={() => handleDeleteSingle(q.id)}
                                    disabled={isPending}
                                    className="px-2.5 py-1 text-xs font-medium bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white rounded-lg transition-colors"
                                  >
                                    {isPending ? '…' : '✓'}
                                  </button>
                                  <button
                                    onClick={() => setConfirmSingleId(null)}
                                    disabled={isPending}
                                    className="px-2.5 py-1 text-xs font-medium bg-gray-800 hover:bg-gray-700 text-gray-400 rounded-lg transition-colors"
                                  >
                                    ✕
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => setConfirmSingleId(q.id)}
                                  className="px-2.5 py-1 text-xs font-medium bg-gray-800 hover:bg-gray-700 text-red-400 hover:text-red-300 rounded-lg transition-colors"
                                >
                                  Eliminar
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* Expanded detail row */}
                        {isExpanded && (
                          <tr className="border-b border-gray-800/50 bg-gray-800/20">
                            <td colSpan={7} className="px-6 py-5">
                              <div className="space-y-4 max-w-3xl">
                                <p className="text-white text-sm leading-relaxed">{q.statement}</p>

                                <div className="flex flex-wrap gap-2">
                                  {opts.map((opt, oi) => (
                                    <span
                                      key={opt.id}
                                      className={`text-xs px-3 py-1.5 rounded-lg border ${
                                        opt.is_correct
                                          ? 'bg-green-900/40 border-green-700/50 text-green-300'
                                          : 'bg-gray-800 border-gray-700/50 text-gray-400'
                                      }`}
                                    >
                                      {opt.is_correct ? '✓ ' : ''}{opt.text ?? `Opción ${oi + 1}`}
                                    </span>
                                  ))}
                                </div>

                                {q.explanation && (
                                  <div className="text-xs text-gray-400 bg-gray-900/80 rounded-lg px-3 py-2 border border-gray-800">
                                    <span className="text-gray-600 font-medium">Explicación: </span>
                                    {q.explanation}
                                  </div>
                                )}

                                <div className="flex flex-wrap gap-4 text-xs text-gray-600">
                                  <span>Creada: {new Date(q.created_at).toLocaleString('es-ES')}</span>
                                  <span>Actualizada: {new Date(q.updated_at).toLocaleString('es-ES')}</span>
                                  <span>{opts.length} opciones</span>
                                  {dupInfo && (
                                    <button
                                      onClick={() => setComparingQId(q.id)}
                                      className={`underline underline-offset-2 transition-opacity hover:opacity-80 ${
                                        dupInfo.level === 'exact' ? 'text-red-500' : 'text-orange-500'
                                      }`}
                                    >
                                      {dupInfo.level === 'exact' ? '⚠ Duplicado exacto' : '⚠ Conflicto de respuestas'} — ver comparación
                                    </button>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-4 px-4 py-3 border-t border-gray-800">
              <span className="text-xs text-gray-500">
                Página {safePage} de {totalPages}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(1)}
                  disabled={safePage === 1}
                  className="px-2 py-1.5 text-xs text-gray-400 hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  «
                </button>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                  className="px-2 py-1.5 text-xs text-gray-400 hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  ‹
                </button>
                {pageList().map((p, idx) =>
                  p === '...'
                    ? <span key={`ellipsis-${idx}`} className="px-2 py-1.5 text-xs text-gray-600">…</span>
                    : (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`px-2.5 py-1.5 text-xs rounded-lg transition-colors ${
                          p === safePage
                            ? 'bg-blue-600 text-white font-medium'
                            : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                        }`}
                      >
                        {p}
                      </button>
                    ),
                )}
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                  className="px-2 py-1.5 text-xs text-gray-400 hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  ›
                </button>
                <button
                  onClick={() => setPage(totalPages)}
                  disabled={safePage === totalPages}
                  className="px-2 py-1.5 text-xs text-gray-400 hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  »
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Comparison modal */}
      {(() => {
        if (!comparingQId) return null
        const q = questions.find(x => x.id === comparingQId)
        const info = dupMap.get(comparingQId)
        if (!q || !info) return null
        const toCompareQuestion = (src: QuestionWithOptions): CompareQuestion => ({
          statement: src.statement,
          options: [...src.question_options]
            .sort((a, b) => a.position - b.position)
            .map(o => ({ text: o.text ?? '', isCorrect: o.is_correct })),
        })
        return (
          <DuplicateCompareModal
            level={info.level}
            incomingLabel="Esta pregunta"
            incoming={toCompareQuestion(q)}
            existing={info.matches.map(toCompareQuestion)}
            onClose={() => setComparingQId(null)}
          />
        )
      })()}

      {/* Bulk delete confirmation modal */}
      {confirmBulkDelete && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <h3 className="text-base font-semibold text-white">
              Eliminar {selected.size} pregunta{selected.size !== 1 ? 's' : ''}
            </h3>
            <p className="text-sm text-gray-400">
              Esta acción es irreversible. Se eliminarán también todas sus opciones de respuesta.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmBulkDelete(false)}
                disabled={isPending}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteBulk}
                disabled={isPending}
                className="px-4 py-2 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {isPending ? 'Eliminando…' : 'Eliminar todo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

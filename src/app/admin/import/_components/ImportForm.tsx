'use client'

import { useState, useTransition } from 'react'
import { importQuestions, type ImportRow } from '../actions'

const SAMPLE_CSV = `asignatura,tema,enunciado,opcion1,opcion2,opcion3,opcion4,correcta
Ejemplo,Tema 1,¿Cuál es la capital de España?,Madrid,Barcelona,Sevilla,Valencia,1
Ejemplo,Tema 1,¿Cuántos lados tiene un triángulo?,2,3,4,5,2
Ejemplo,Tema 2,¿Qué gas respiramos principalmente?,Oxígeno,Nitrógeno,Dióxido de carbono,2`

type ParsedRow = ImportRow & { rowNumber: number; parseError?: string }

type Result = { imported: number; errors: number }

function parseCSV(text: string): ParsedRow[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  const rows: ParsedRow[] = []

  // Skip header (first line) and empty lines
  for (let li = 1; li < lines.length; li++) {
    const line = lines[li].trim()
    if (!line) continue

    const cols = splitCSVLine(line)
    const rowNumber = li + 1 // 1-based, counting header as row 1

    // Determine column count: 6 = 2 opts, 7 = 3 opts, 8 = 4 opts
    const numCols = cols.length
    if (numCols < 6) {
      rows.push({
        rowNumber,
        subject: '', topic: '', statement: '',
        options: [], correctIndex: 0,
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
        rowNumber, subject, topic, statement,
        options, correctIndex: 0,
        parseError: 'Asignatura, tema o enunciado vacío',
      })
      continue
    }

    const correctaNum = parseInt(correctaRaw, 10)
    if (isNaN(correctaNum) || correctaNum < 1 || correctaNum > options.length) {
      rows.push({
        rowNumber, subject, topic, statement, options,
        correctIndex: 0,
        parseError: `Columna "correcta" inválida: "${correctaRaw}" (opciones: 1–${options.length})`,
      })
      continue
    }

    rows.push({ rowNumber, subject, topic, statement, options, correctIndex: correctaNum - 1 })
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

export default function ImportForm() {
  const [rows, setRows] = useState<ParsedRow[] | null>(null)
  const [fileName, setFileName] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const validRows = rows?.filter(r => !r.parseError) ?? []
  const invalidRows = rows?.filter(r => r.parseError) ?? []

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setResult(null)
    setImportError(null)

    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      setRows(parseCSV(text))
    }
    reader.readAsText(file, 'utf-8')
  }

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
        setRows(null)
        setFileName('')
      }
    })
  }

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
      {rows && rows.length > 0 && (
        <div className="space-y-4">

          {/* Stats */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400">
              <span className="text-white font-semibold">{rows.length}</span> filas detectadas —
              <span className="text-green-400 font-semibold"> {validRows.length}</span> válidas
              {invalidRows.length > 0 && (
                <>, <span className="text-red-400 font-semibold">{invalidRows.length}</span> con error</>
              )}
            </span>
          </div>

          {/* Invalid rows */}
          {invalidRows.length > 0 && (
            <div className="bg-red-950/30 border border-red-800/50 rounded-xl p-4 space-y-2">
              <p className="text-xs font-semibold text-red-400 uppercase tracking-wide">Filas con error (se omitirán)</p>
              {invalidRows.map(r => (
                <div key={r.rowNumber} className="text-xs text-red-300 flex gap-2">
                  <span className="text-red-500 font-mono flex-shrink-0">Fila {r.rowNumber}:</span>
                  <span>{r.parseError}</span>
                </div>
              ))}
            </div>
          )}

          {/* Valid rows preview */}
          {validRows.length > 0 && (
            <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Vista previa</p>
                <span className="text-xs text-gray-600">{validRows.length} preguntas</span>
              </div>
              <div className="divide-y divide-gray-800/60 max-h-96 overflow-y-auto">
                {validRows.map((row, i) => (
                  <div key={i} className="px-4 py-3 space-y-1.5">
                    <div className="flex items-start gap-2">
                      <span className="text-xs text-gray-600 tabular-nums w-5 flex-shrink-0 mt-0.5">{i + 1}.</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs px-2 py-0.5 bg-gray-800 text-gray-400 rounded-full truncate max-w-[35%]">
                            {row.subject}
                          </span>
                          <span className="text-xs text-gray-600 truncate max-w-[35%]">{row.topic}</span>
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
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Import button */}
          {validRows.length > 0 && (
            <button
              onClick={handleImport}
              disabled={isPending}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors shadow-lg shadow-blue-900/30 text-sm"
            >
              {isPending
                ? 'Importando…'
                : `Importar ${validRows.length} pregunta${validRows.length !== 1 ? 's' : ''}`}
            </button>
          )}
        </div>
      )}

      {rows && rows.length === 0 && (
        <p className="text-center text-gray-500 text-sm py-4">
          El archivo no contiene filas de datos (solo cabecera o vacío).
        </p>
      )}
    </div>
  )
}

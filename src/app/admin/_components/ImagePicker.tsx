'use client'

import { useRef, useEffect, useState } from 'react'

type Props = {
  url: string
  file: File | null
  onUrlChange: (url: string) => void
  onFileChange: (file: File | null) => void
  label?: string
  optional?: boolean
  /** Compact mode: used inside option rows. No dashed border, smaller preview. */
  compact?: boolean
}

export default function ImagePicker({
  url,
  file,
  onUrlChange,
  onFileChange,
  label,
  optional,
  compact = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  // Create blob URL once per file change and revoke on cleanup to avoid
  // creating a new object URL on every parent re-render (e.g. typing in text).
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!file) { setBlobUrl(null); return }
    const blob = URL.createObjectURL(file)
    setBlobUrl(blob)
    return () => URL.revokeObjectURL(blob)
  }, [file])

  const preview = blobUrl ?? url ?? null
  const hasImage = !!preview

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0]
    if (!picked) return
    onFileChange(picked)
    onUrlChange('') // file takes precedence — clear any typed URL
    // reset the input so the same file can be re-selected after clearing
    e.target.value = ''
  }

  function handleUrlChange(value: string) {
    onUrlChange(value)
    if (value) onFileChange(null) // URL takes precedence — drop any pending file
  }

  function handleClear() {
    onFileChange(null)
    onUrlChange('')
    if (inputRef.current) inputRef.current.value = ''
  }

  // Hidden file input shared between both modes
  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept="image/*"
      onChange={handleFileInput}
      className="hidden"
    />
  )

  if (hasImage) {
    return (
      <div className={compact ? '' : 'space-y-1.5'}>
        {label && !compact && (
          <p className="text-sm font-medium text-ink-muted">
            {label}{' '}
            {optional && <span className="text-ink-dim font-normal">(opcional)</span>}
          </p>
        )}
        {fileInput}
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="Vista previa"
            className={`rounded-lg border border-wire object-contain bg-surface-input/60 ${
              compact ? 'max-h-16 max-w-[8rem]' : 'max-h-40 max-w-full'
            }`}
          />
          <div className="space-y-1.5 pt-0.5">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="block text-xs text-ink-dim hover:text-blue-400 transition-colors"
            >
              Cambiar imagen
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="block text-xs text-ink-ghost hover:text-red-400 transition-colors"
            >
              × Eliminar
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── No image ──────────────────────────────────────────────────

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {fileInput}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex-shrink-0 text-xs text-ink-ghost hover:text-blue-400 transition-colors"
        >
          📷 Subir imagen
        </button>
        <span className="text-wire-muted select-none">|</span>
        <input
          type="text"
          value={url}
          onChange={e => handleUrlChange(e.target.value)}
          placeholder="o pegar URL…"
          className="flex-1 min-w-0 text-xs bg-transparent text-ink-faint placeholder-ink-ghost focus:outline-none focus:text-ink"
        />
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      {label && (
        <p className="text-sm font-medium text-ink-muted">
          {label}{' '}
          {optional && <span className="text-ink-dim font-normal">(opcional)</span>}
        </p>
      )}
      {fileInput}
      <div className="border border-dashed border-wire rounded-lg p-4 space-y-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full py-2 px-4 bg-surface-input hover:bg-surface-hover border border-wire rounded-lg text-sm text-ink-muted transition-colors text-center"
        >
          Subir desde dispositivo
        </button>

        <div className="flex items-center gap-2">
          <div className="flex-1 h-px bg-wire" />
          <span className="text-xs text-ink-ghost select-none">o</span>
          <div className="flex-1 h-px bg-wire" />
        </div>

        <input
          type="text"
          value={url}
          onChange={e => handleUrlChange(e.target.value)}
          placeholder="Pegar URL de imagen…"
          className="w-full px-3 py-2 bg-surface-input border border-wire rounded-lg text-sm text-ink-strong placeholder-ink-dim focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>
    </div>
  )
}

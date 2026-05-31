'use client'

import { useRef, useLayoutEffect, useCallback, type TextareaHTMLAttributes } from 'react'

type Props = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'rows'> & {
  /** Altura mínima en líneas (también el valor de `rows` para el render inicial). */
  minRows?: number
  /** A partir de esta altura el cuadro deja de crecer y hace scroll. */
  maxRows?: number
}

/**
 * Textarea que crece en altura según el contenido, sin scroll interno,
 * hasta `maxRows`. A partir de ahí mantiene la altura y hace scroll.
 */
export default function AutoGrowTextarea({
  value,
  onChange,
  className = '',
  minRows = 3,
  maxRows = 12,
  ...rest
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)

  const resize = useCallback((el: HTMLTextAreaElement) => {
    const cs = getComputedStyle(el)
    const lineHeight = parseFloat(cs.lineHeight) || 20
    const padding = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0)
    const border = (parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.borderBottomWidth) || 0)
    const minHeight = lineHeight * minRows + padding + border
    const maxHeight = lineHeight * maxRows + padding + border

    el.style.height = 'auto'
    // scrollHeight no incluye el borde (box-sizing: border-box), lo sumamos.
    const content = el.scrollHeight + border
    el.style.height = `${Math.min(Math.max(content, minHeight), maxHeight)}px`
    el.style.overflowY = content > maxHeight ? 'auto' : 'hidden'
  }, [minRows, maxRows])

  // Reajusta al cambiar el valor (incluye resets externos del formulario).
  useLayoutEffect(() => {
    if (ref.current) resize(ref.current)
  }, [value, resize])

  return (
    <textarea
      ref={ref}
      value={value}
      rows={minRows}
      onChange={e => { onChange?.(e); resize(e.target) }}
      className={`resize-none overflow-hidden ${className}`}
      {...rest}
    />
  )
}

/**
 * Normaliza texto para comparar duplicados de preguntas/opciones:
 * - minúsculas
 * - sin espacios sobrantes (recorta extremos y colapsa los internos)
 * - sin puntuación final (. , ; :)
 *
 * Así, p. ej., "…fabricantes." y "…fabricantes" se consideran iguales.
 * Se usa tanto en el servidor (detección) como en el cliente
 * (previsualización y modal de comparación) para que el criterio coincida.
 */
export function normalizeText(value: string | null | undefined): string {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')      // colapsar espacios internos (incluye dobles)
    .replace(/[.,;:]+$/u, '')  // quitar puntuación final
    .trim()
}

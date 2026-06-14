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

/**
 * Forma canónica de un nombre de asignatura o tema.
 * - recorta extremos y colapsa espacios internos
 * - Title Case equivalente a INITCAP de Postgres (primera letra de cada
 *   palabra en mayúscula, el resto en minúscula)
 *
 * Es la ÚNICA forma con la que se comparan y se escriben los nombres, para que
 * la previsualización del import, el upsert y el índice UNIQUE de la BD usen el
 * mismo criterio. Sin esto, "matemáticas" y "Matemáticas" crean duplicados:
 * el preview (case-insensitive) los ve iguales pero el upsert (case-sensitive)
 * inserta una segunda fila.
 */
export function canonicalizeName(value: string | null | undefined): string {
  return (value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/(^|[^\p{L}\p{N}])(\p{L})/gu, (_, sep, ch) => sep + ch.toUpperCase())
}

-- ============================================================
-- Migración 001: Eliminar campo created_by de questions
-- App personal sin login público — el campo no aporta valor.
-- ============================================================

-- 1. Eliminar políticas RLS que dependen de created_by
DROP POLICY IF EXISTS "Usuarios ven sus propias preguntas"    ON questions;
DROP POLICY IF EXISTS "Usuarios crean sus propias preguntas"  ON questions;
DROP POLICY IF EXISTS "Usuarios editan sus propias preguntas" ON questions;
DROP POLICY IF EXISTS "Usuarios eliminan sus propias preguntas" ON questions;

-- Las políticas de question_options hacen JOIN con questions.created_by
DROP POLICY IF EXISTS "Usuarios ven opciones de sus preguntas"    ON question_options;
DROP POLICY IF EXISTS "Usuarios crean opciones en sus preguntas"  ON question_options;
DROP POLICY IF EXISTS "Usuarios editan opciones de sus preguntas" ON question_options;
DROP POLICY IF EXISTS "Usuarios eliminan opciones de sus preguntas" ON question_options;

-- 2. Eliminar índice sobre created_by
DROP INDEX IF EXISTS idx_questions_created_by;

-- 3. Eliminar la columna (elimina automáticamente la FK constraint)
ALTER TABLE questions DROP COLUMN IF EXISTS created_by;

-- 4. Nuevas políticas abiertas (admin accede via service role que bypasa RLS)
--    El cliente anónimo/público no podrá leer ni escribir preguntas.
CREATE POLICY "Solo service role puede gestionar preguntas"
  ON questions FOR ALL
  USING (false)
  WITH CHECK (false);

CREATE POLICY "Solo service role puede gestionar opciones"
  ON question_options FOR ALL
  USING (false)
  WITH CHECK (false);

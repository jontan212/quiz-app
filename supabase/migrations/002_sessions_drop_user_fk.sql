-- ============================================================
-- Migración 002: Eliminar user_id de sessions
-- App personal sin login público — el campo no aporta valor.
-- ============================================================

-- 1. Eliminar políticas RLS que dependen de user_id
DROP POLICY IF EXISTS "Usuarios ven sus propias sesiones"   ON sessions;
DROP POLICY IF EXISTS "Usuarios crean sus propias sesiones" ON sessions;

-- 2. Eliminar índice sobre user_id
DROP INDEX IF EXISTS idx_sessions_user_id;

-- 3. Eliminar la columna (elimina automáticamente la FK constraint)
ALTER TABLE sessions DROP COLUMN IF EXISTS user_id;

-- 4. Nueva política: solo service role puede operar (RLS bloqueante para anon)
CREATE POLICY "Solo service role puede gestionar sesiones"
  ON sessions FOR ALL
  USING (false)
  WITH CHECK (false);

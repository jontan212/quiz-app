-- ============================================================
-- Tablas de asignaturas y temas como entidades propias
-- ============================================================

CREATE TABLE subjects (
  id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL
);

CREATE TABLE topics (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  UNIQUE(subject_id, name)
);

-- ── Migrar datos existentes desde questions ─────────────────
-- Normaliza con INITCAP (primera letra de cada palabra en mayúscula)

INSERT INTO subjects (name)
SELECT DISTINCT INITCAP(subject)
FROM questions
WHERE subject IS NOT NULL AND subject <> ''
ON CONFLICT (name) DO NOTHING;

INSERT INTO topics (subject_id, name)
SELECT DISTINCT s.id, INITCAP(q.topic)
FROM questions q
JOIN subjects s ON s.name = INITCAP(q.subject)
WHERE q.topic IS NOT NULL AND q.topic <> ''
ON CONFLICT (subject_id, name) DO NOTHING;

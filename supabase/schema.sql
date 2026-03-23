-- ============================================================
-- QUIZ APP — Schema
-- ============================================================

-- ------------------------------------------------------------
-- EXTENSIONES
-- ------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ============================================================
-- TABLAS
-- ============================================================

-- ------------------------------------------------------------
-- 1. PREGUNTAS
-- ------------------------------------------------------------
CREATE TABLE questions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  statement   TEXT        NOT NULL,
  image_url   TEXT,
  subject     TEXT        NOT NULL,
  topic       TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 2. OPCIONES DE RESPUESTA
-- ------------------------------------------------------------
CREATE TABLE question_options (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID        NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  text        TEXT,
  image_url   TEXT,
  is_correct  BOOLEAN     NOT NULL DEFAULT FALSE,
  position    SMALLINT    NOT NULL DEFAULT 0,  -- orden de visualización
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- al menos texto o imagen debe estar presente
  CONSTRAINT text_or_image CHECK (text IS NOT NULL OR image_url IS NOT NULL)
);

-- ------------------------------------------------------------
-- 3. SESIONES (estadísticas por test)
-- ------------------------------------------------------------
CREATE TABLE sessions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  subject          TEXT        NOT NULL,
  topics           TEXT[]      NOT NULL DEFAULT '{}',
  total_questions  INT         NOT NULL CHECK (total_questions > 0),
  correct_answers  INT         NOT NULL CHECK (correct_answers >= 0),
  started_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at      TIMESTAMPTZ,

  CONSTRAINT correct_lte_total CHECK (correct_answers <= total_questions)
);

-- ------------------------------------------------------------
-- 4. CONFIGURACIÓN DE USUARIO
-- ------------------------------------------------------------
CREATE TABLE user_config (
  user_id                UUID    PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  default_question_count INT     NOT NULL DEFAULT 10 CHECK (default_question_count > 0),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX idx_questions_subject    ON questions(subject);
CREATE INDEX idx_questions_topic      ON questions(topic);

CREATE INDEX idx_question_options_question_id ON question_options(question_id);

CREATE INDEX idx_sessions_subject   ON sessions(subject);
CREATE INDEX idx_sessions_started_at ON sessions(started_at DESC);


-- ============================================================
-- TRIGGER: updated_at automático
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_questions_updated_at
  BEFORE UPDATE ON questions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_user_config_updated_at
  BEFORE UPDATE ON user_config
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ============================================================
-- TRIGGER: crear user_config al registrar usuario
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_config (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE questions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_config   ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- Políticas: questions
-- ------------------------------------------------------------
CREATE POLICY "Usuarios ven sus propias preguntas"
  ON questions FOR SELECT
  USING (created_by = auth.uid());

CREATE POLICY "Usuarios crean sus propias preguntas"
  ON questions FOR INSERT
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Usuarios editan sus propias preguntas"
  ON questions FOR UPDATE
  USING (created_by = auth.uid());

CREATE POLICY "Usuarios eliminan sus propias preguntas"
  ON questions FOR DELETE
  USING (created_by = auth.uid());

-- ------------------------------------------------------------
-- Políticas: question_options (acceso a través de la pregunta)
-- ------------------------------------------------------------
CREATE POLICY "Usuarios ven opciones de sus preguntas"
  ON question_options FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM questions
      WHERE questions.id = question_options.question_id
        AND questions.created_by = auth.uid()
    )
  );

CREATE POLICY "Usuarios crean opciones en sus preguntas"
  ON question_options FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM questions
      WHERE questions.id = question_options.question_id
        AND questions.created_by = auth.uid()
    )
  );

CREATE POLICY "Usuarios editan opciones de sus preguntas"
  ON question_options FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM questions
      WHERE questions.id = question_options.question_id
        AND questions.created_by = auth.uid()
    )
  );

CREATE POLICY "Usuarios eliminan opciones de sus preguntas"
  ON question_options FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM questions
      WHERE questions.id = question_options.question_id
        AND questions.created_by = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- Políticas: sessions
-- ------------------------------------------------------------
CREATE POLICY "Usuarios ven sus propias sesiones"
  ON sessions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Usuarios crean sus propias sesiones"
  ON sessions FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- las sesiones no se editan ni eliminan (registro histórico)

-- ------------------------------------------------------------
-- Políticas: user_config
-- ------------------------------------------------------------
CREATE POLICY "Usuarios ven su propia configuración"
  ON user_config FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Usuarios actualizan su propia configuración"
  ON user_config FOR UPDATE
  USING (user_id = auth.uid());

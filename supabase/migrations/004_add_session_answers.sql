-- Track individual question results per session
CREATE TABLE session_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
  answered_correctly BOOLEAN NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

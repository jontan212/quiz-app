// ============================================================
// Tipos base — espejo del schema de Supabase
// ============================================================

export type Question = {
  id: string;
  statement: string;
  image_url: string | null;
  explanation: string | null;
  subject: string;
  topic: string;
  created_at: string;
  updated_at: string;
};

export type QuestionOption = {
  id: string;
  question_id: string;
  text: string | null;
  image_url: string | null;
  is_correct: boolean;
  position: number;
  created_at: string;
};

export type Session = {
  id: string;
  subject: string;
  topics: string[];
  total_questions: number;
  correct_answers: number;
  started_at: string;
  finished_at: string | null;
};

export type UserConfig = {
  user_id: string;
  default_question_count: number;
  created_at: string;
  updated_at: string;
};

// ============================================================
// Tipos de relaciones (joins frecuentes)
// ============================================================

export type QuestionWithOptions = Question & {
  question_options: QuestionOption[];
};

// ============================================================
// Tipos de catálogo
// ============================================================

export type Subject = {
  id: string;
  name: string;
};

export type Topic = {
  id: string;
  subject_id: string;
  name: string;
};

// ============================================================
// Tipos de formulario
// ============================================================

export type QuestionOptionFormData = {
  text: string;
  image_url: string;
  is_correct: boolean;
  position: number;
};

export type CreateQuestionFormData = {
  statement: string;
  image_url: string;
  explanation: string;
  subject: string;
  topic: string;
  options: QuestionOptionFormData[];
};

export type UpdateQuestionFormData = Partial<
  Pick<Question, 'statement' | 'image_url' | 'explanation' | 'subject' | 'topic'>
> & {
  options?: QuestionOptionFormData[];
};

export type UpdateUserConfigFormData = {
  default_question_count: number;
};

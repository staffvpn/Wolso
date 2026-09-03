-- Один файл на весь заход: миграции здесь применяются руками, и три
-- отдельных файла — это три шанса применить не все.

-- 1. Жалобы. Пожаловаться было нельзя ни на кого и ни на что: ни на
-- анкету, ни на вакансию, ни на поведение в чате. Для площадки, где люди
-- потом встречаются офлайн, это главная дыра. Таблица с таким именем была
-- в 0001 и её удалили в 0011 вместе со старой модерацией — эта другая:
-- у неё есть автор жалобы, предмет, статус и решение.
--
-- target_kind: 'worker' | 'company' | 'shift'
-- status:      'new' | 'reviewing' | 'resolved' | 'rejected'
CREATE TABLE complaints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  author_kind TEXT NOT NULL,
  author_worker_id INTEGER REFERENCES workers(id) ON DELETE CASCADE,
  author_company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
  target_kind TEXT NOT NULL,
  target_worker_id INTEGER REFERENCES workers(id) ON DELETE CASCADE,
  target_company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
  target_shift_id INTEGER REFERENCES shifts(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  comment TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'new',
  resolution TEXT,
  resolved_by TEXT,
  resolved_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_complaints_status ON complaints(status, created_at);
CREATE INDEX idx_complaints_target_worker ON complaints(target_worker_id);
CREATE INDEX idx_complaints_target_company ON complaints(target_company_id);

-- 2. Те же переключатели уведомлений, что появились у соискателей, —
-- работодателям. Бот пишет им не меньше, а выключить это было нельзя.
ALTER TABLE companies ADD COLUMN notify_new_responses INTEGER NOT NULL DEFAULT 1;
ALTER TABLE companies ADD COLUMN notify_worker_replies INTEGER NOT NULL DEFAULT 1;
ALTER TABLE companies ADD COLUMN notify_pending_reminder INTEGER NOT NULL DEFAULT 1;

-- 3. Заметки команды по пользователю. История решений («звонил, обещал
-- поменять фото») жила в голове у того, кто решал.
CREATE TABLE user_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_kind TEXT NOT NULL,
  worker_id INTEGER REFERENCES workers(id) ON DELETE CASCADE,
  company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  author_name TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_user_notes_worker ON user_notes(worker_id, created_at);
CREATE INDEX idx_user_notes_company ON user_notes(company_id, created_at);

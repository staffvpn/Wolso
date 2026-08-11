-- Worker (gig-seeker) side
CREATE TABLE workers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id INTEGER UNIQUE NOT NULL,
  name TEXT NOT NULL,
  photo_url TEXT,
  city TEXT NOT NULL DEFAULT 'Москва',
  rating REAL NOT NULL DEFAULT 5.0,
  shifts_completed INTEGER NOT NULL DEFAULT 0,
  referral_code TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE worker_positions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  worker_id INTEGER NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  position TEXT NOT NULL,
  position_label TEXT NOT NULL,
  years INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_worker_positions_worker ON worker_positions(worker_id);

CREATE TABLE worker_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  worker_id INTEGER NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL,
  label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'missing',
  note TEXT,
  file_key TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_worker_documents_worker ON worker_documents(worker_id);

-- Employer side
CREATE TABLE companies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_telegram_id INTEGER UNIQUE NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  city TEXT NOT NULL DEFAULT 'Москва',
  logo_initial TEXT NOT NULL DEFAULT 'W',
  logo_color TEXT NOT NULL DEFAULT '#1fae63',
  rating REAL NOT NULL DEFAULT 5.0,
  reviews_count INTEGER NOT NULL DEFAULT 0,
  verified INTEGER NOT NULL DEFAULT 0,
  inn TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Shifts double as "vacancies": status carries them through moderation.
CREATE TABLE shifts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  position TEXT NOT NULL,
  position_label TEXT NOT NULL,
  date TEXT NOT NULL,
  start_hour INTEGER NOT NULL,
  start_min INTEGER NOT NULL DEFAULT 0,
  end_hour INTEGER NOT NULL,
  end_min INTEGER NOT NULL DEFAULT 0,
  hourly_rate INTEGER NOT NULL,
  total_pay INTEGER NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  meal INTEGER NOT NULL DEFAULT 0,
  urgency TEXT NOT NULL DEFAULT 'normal',
  employment_type TEXT NOT NULL DEFAULT 'shift',
  time_of_day TEXT NOT NULL DEFAULT 'day',
  requirements TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending_review',
  moderation_flag_label TEXT,
  moderation_flag_tone TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_shifts_company ON shifts(company_id);
CREATE INDEX idx_shifts_status ON shifts(status);

CREATE TABLE applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shift_id INTEGER NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  worker_id INTEGER NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  work_stage TEXT NOT NULL DEFAULT 'upcoming',
  check_in_at TEXT,
  check_out_at TEXT,
  rating INTEGER,
  review_tags TEXT,
  review_comment TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(shift_id, worker_id)
);
CREATE INDEX idx_applications_worker ON applications(worker_id);
CREATE INDEX idx_applications_shift ON applications(shift_id);

CREATE TABLE favorite_shifts (
  worker_id INTEGER NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  shift_id INTEGER NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  PRIMARY KEY (worker_id, shift_id)
);

CREATE TABLE favorite_companies (
  worker_id INTEGER NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  PRIMARY KEY (worker_id, company_id)
);

CREATE TABLE chats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  worker_id INTEGER NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  shift_id INTEGER REFERENCES shifts(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(company_id, worker_id, shift_id)
);
CREATE INDEX idx_chats_worker ON chats(worker_id);
CREATE INDEX idx_chats_company ON chats(company_id);

CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  sender TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'text',
  text TEXT NOT NULL,
  read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_messages_chat ON messages(chat_id);

CREATE TABLE notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  worker_id INTEGER REFERENCES workers(id) ON DELETE CASCADE,
  company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT,
  read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_notifications_worker ON notifications(worker_id);
CREATE INDEX idx_notifications_company ON notifications(company_id);

-- Admin / staff side
CREATE TABLE roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  is_system INTEGER NOT NULL DEFAULT 0,
  color TEXT NOT NULL DEFAULT '#6b6d76',
  permissions TEXT NOT NULL
);

CREATE TABLE staff (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id INTEGER UNIQUE,
  name TEXT NOT NULL,
  email TEXT,
  role_id TEXT NOT NULL REFERENCES roles(id),
  status TEXT NOT NULL DEFAULT 'invited',
  since INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE complaints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_name TEXT NOT NULL,
  target_type TEXT NOT NULL,
  reporter_name TEXT,
  reason TEXT,
  text TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_name TEXT NOT NULL,
  actor_role_label TEXT,
  action TEXT NOT NULL,
  tone TEXT NOT NULL DEFAULT 'neutral',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

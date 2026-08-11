-- Wolso Support: a separate channel from worker<->employer chat. One
-- thread per account, created lazily on first message. Messages are never
-- deletable — there is intentionally no DELETE route for these tables.
CREATE TABLE support_threads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  worker_id INTEGER REFERENCES workers(id) ON DELETE CASCADE,
  company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX idx_support_threads_worker ON support_threads(worker_id) WHERE worker_id IS NOT NULL;
CREATE UNIQUE INDEX idx_support_threads_company ON support_threads(company_id) WHERE company_id IS NOT NULL;

CREATE TABLE support_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id INTEGER NOT NULL REFERENCES support_threads(id) ON DELETE CASCADE,
  sender TEXT NOT NULL, -- 'user' | 'staff'
  staff_name TEXT,
  text TEXT NOT NULL,
  read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_support_messages_thread ON support_messages(thread_id);

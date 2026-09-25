-- Кому реально ушло автоматическое сообщение в бот — не то же самое, что
-- «_reminded_at» столбцы по всему reminders.ts: те помнят только последний
-- раз и существуют, чтобы крон не долбился в один чат каждый час, а не
-- чтобы на это можно было посмотреть в дашборде. recipient_name — снимок
-- на момент отправки (тот же приём, что actor_name в audit_log), а не join
-- в реальном времени: имя могло с тех пор поменяться.
CREATE TABLE notification_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipient_role TEXT NOT NULL CHECK(recipient_role IN ('worker', 'company')),
  recipient_id INTEGER NOT NULL,
  recipient_name TEXT NOT NULL,
  kind TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_notification_log_created_at ON notification_log(created_at);
CREATE INDEX idx_notification_log_recipient ON notification_log(recipient_role, recipient_id);

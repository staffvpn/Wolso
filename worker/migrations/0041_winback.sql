-- Возврат тех, кто зарегистрировался и пропал: last_seen_at копится на
-- каждый /auth/telegram (см. routes/auth.ts) и кормит два механизма —
-- «напомнить про новые смены тому, кого давно не было» (lib/reminders.ts)
-- и бейджи за то, что заходят день за днём (login_streak_days, условие
-- 'login_streak' в lib/achievements.ts). companies тоже копит last_seen_at
-- заодно — тот же столбец, тот же UPDATE, что и telegram_username ниже
-- по auth.ts, — на будущее для аналогичного напоминания работодателям.

ALTER TABLE workers ADD COLUMN last_seen_at TEXT;
ALTER TABLE workers ADD COLUMN dormant_reminded_at TEXT;
ALTER TABLE workers ADD COLUMN login_streak_days INTEGER NOT NULL DEFAULT 0;
ALTER TABLE companies ADD COLUMN last_seen_at TEXT;

INSERT OR IGNORE INTO achievements (key, title, description, icon, kind, condition_type, threshold, threshold2, status, sort_order) VALUES
  ('streak_3', 'Разогрелся', 'Заходили в Wolso 3 дня подряд.', 'Flame', 'auto', 'login_streak', 3, NULL, 'active', 45),
  ('streak_7', 'Неделя в деле', 'Заходили в Wolso 7 дней подряд.', 'Flame', 'auto', 'login_streak', 7, NULL, 'active', 50);

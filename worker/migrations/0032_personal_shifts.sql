-- Личные смены: работа, которую человек нашёл сам — через знакомых, чат,
-- напрямую у заведения. Wolso к ней отношения не имеет, и это принципиально:
-- отдельная таблица, а не строка в shifts с флагом.
--
-- Почему отдельная таблица. У shifts есть company_id, отклики, приглашения,
-- модерация, рейтинги и статистика работодателя — всё это к личной смене
-- неприменимо, и любой флаг «это личная» пришлось бы вспоминать в каждом
-- запросе поиска, ленты, дашборда и воронки. Забыли в одном — и чужая
-- запись протекла работодателю. Здесь протечь физически нечему: таблицу
-- читают только четыре ручки самого соискателя.
--
-- Статус (запланирована / отработана) не хранится: он выводится из даты.
-- Колонка, которую надо переключать по расписанию, — это ещё один крон и
-- ещё один способ разъехаться с реальностью.
CREATE TABLE personal_shifts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  worker_id INTEGER NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  place_name TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  position_label TEXT NOT NULL,
  date TEXT NOT NULL,
  start_hour INTEGER NOT NULL,
  start_min INTEGER NOT NULL DEFAULT 0,
  end_hour INTEGER NOT NULL,
  end_min INTEGER NOT NULL DEFAULT 0,
  -- Оплата за смену целиком, а не ставка в час: человек, которого позвали
  -- в чате, обычно договаривается именно на сумму за выход.
  pay INTEGER NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);
CREATE INDEX idx_personal_shifts_worker ON personal_shifts(worker_id, date);

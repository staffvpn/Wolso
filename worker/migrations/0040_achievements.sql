-- Бейджи за смены, рейтинг и стаж — только у соискателей. Правила
-- считает воркер (lib/achievements.ts), эта таблица хранит порог и то,
-- какое условие проверять, а не сам результат. condition_type пустой
-- у ручных бейджей: там формулы нет, есть только кнопка у стаффа.
CREATE TABLE achievements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  -- Стабильный ключ для сидовых записей ниже — миграция ничего не
  -- удаляет и не пересоздаёт повторным запуском (INSERT OR IGNORE).
  key TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  -- Имя компонента из lucide-react — набор разрешённых иконок закреплён
  -- в коде (admin и мини-апп), а не тут: свободный текст сюда означало
  -- бы, что опечатка в админке ничего не покажет вместо явной ошибки.
  icon TEXT NOT NULL DEFAULT 'Award',
  kind TEXT NOT NULL CHECK(kind IN ('auto', 'manual')),
  -- Что проверять для 'auto' — см. checkCondition в lib/achievements.ts.
  -- threshold2 нужен только 'top_performer' (второе число — минимум
  -- отзывов), у остальных условий пустой.
  condition_type TEXT,
  threshold REAL,
  threshold2 REAL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'paused')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Кто что получил. auto-бейджи сюда пишет сам воркер при первой же
-- проверке, где условие выполнилось (см. lib/achievements.ts) — как
-- при живом заходе на экран, так и при «Пересчитать» из админки.
-- Ручные — только стаффом, через POST .../achievements.
CREATE TABLE worker_achievements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  worker_id INTEGER NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  achievement_id INTEGER NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  earned_at TEXT NOT NULL DEFAULT (datetime('now')),
  -- Имя сотрудника, выдавшего вручную (и для auto-бейджей тоже, если их
  -- позже пришлось выдать руками за баг) — null у обычной автовыдачи.
  granted_by TEXT,
  -- «За что» — только для ручной выдачи, видно команде на карточке
  -- пользователя, самому человеку не показывается.
  note TEXT,
  UNIQUE (worker_id, achievement_id)
);
CREATE INDEX idx_worker_achievements_worker ON worker_achievements(worker_id);
CREATE INDEX idx_worker_achievements_achievement ON worker_achievements(achievement_id);

-- Новое право — рядом с managePromos: управлять содержимым площадки
-- (бейджи, их условия) и выдавать/забирать их у конкретных людей —
-- одна и та же ответственность, разносить незачем.
UPDATE roles SET permissions = json_set(permissions, '$.manageAchievements', 'no');
UPDATE roles SET permissions = json_set(permissions, '$.manageAchievements', 'yes') WHERE id IN ('owner', 'admin');

-- Стартовый набор — подтверждённый список. sort_order держит порядок
-- групп (старт → объём → качество → стаж → особые) на экране «Достижения».
INSERT OR IGNORE INTO achievements (key, title, description, icon, kind, condition_type, threshold, threshold2, status, sort_order) VALUES
  ('first_response', 'Первый отклик', 'Отправил(а) самый первый отклик на смену.', 'Send', 'auto', 'first_response', NULL, NULL, 'active', 10),
  ('first_shift', 'Первая смена', 'Закрыл(а) первую смену.', 'Briefcase', 'auto', 'shifts_completed', 1, NULL, 'active', 20),
  ('own_photo', 'Своё фото', 'Заменил(а) аватар из Telegram на настоящее фото.', 'Camera', 'auto', 'own_photo', NULL, NULL, 'active', 30),
  ('profile_complete', 'Анкета заполнена', 'Есть «о себе», навыки и хотя бы одна фотография в профиле.', 'ClipboardCheck', 'auto', 'profile_complete', NULL, NULL, 'active', 40),

  ('shifts_10', '10 смен', 'Закрыл(а) 10 смен.', 'Award', 'auto', 'shifts_completed', 10, NULL, 'active', 100),
  ('shifts_30', '30 смен', 'Закрыл(а) 30 смен.', 'Award', 'auto', 'shifts_completed', 30, NULL, 'active', 110),
  ('shifts_50', 'Профи', 'Закрыл(а) 50 смен.', 'Award', 'auto', 'shifts_completed', 50, NULL, 'active', 120),
  ('shifts_100', 'Ветеран', 'Закрыл(а) 100 смен.', 'Award', 'auto', 'shifts_completed', 100, NULL, 'active', 130),
  ('active_week', 'Активная неделя', '5 и более смен за одну неделю.', 'Zap', 'auto', 'active_week', 5, NULL, 'active', 140),
  ('multi_role', 'Мультиролевой', 'Закрыл(а) смены в 3 и более разных профессиях.', 'Users', 'auto', 'distinct_positions', 3, NULL, 'active', 150),

  ('top_performer', 'Топ-исполнитель', 'Рейтинг 4.8 и выше не менее чем по 15 отзывам.', 'Star', 'auto', 'top_performer', 4.8, 15, 'active', 200),
  ('no_cancel_streak', 'Надёжный', '20 смен подряд без отмены со своей стороны.', 'ShieldCheck', 'auto', 'no_cancel_streak', 20, NULL, 'active', 210),
  ('fast_response', 'Быстрый отклик', 'В среднем откликается быстрее чем за 10 минут после публикации смены.', 'Sparkles', 'auto', 'fast_response', 10, NULL, 'active', 220),

  ('tenure_6', 'Полгода с нами', '6 месяцев с регистрации.', 'Clock', 'auto', 'tenure_months', 6, NULL, 'active', 300),
  ('tenure_12', 'Год с нами', '12 месяцев с регистрации.', 'Clock', 'auto', 'tenure_months', 12, NULL, 'active', 310),
  ('tenure_24', '2 года с нами', '24 месяца с регистрации.', 'Clock', 'auto', 'tenure_months', 24, NULL, 'active', 320),
  ('reviews_given_10', 'Своими словами', 'Оставил(а) 10 и более отзывов работодателям.', 'MessageSquare', 'auto', 'reviews_given', 10, NULL, 'active', 330),

  ('legend', 'Легенда Wolso', 'Выдаётся вручную — для тех, кто явно выделяется.', 'Trophy', 'manual', NULL, NULL, NULL, 'active', 400),
  ('ambassador', 'Амбассадор', 'Выдаётся вручную — активно приводит новых людей на платформу.', 'Megaphone', 'manual', NULL, NULL, NULL, 'active', 410),
  ('forgiven_writeoff', 'Прощено списание', 'Выдаётся вручную — жест доброй воли, а не награда за достижение.', 'Heart', 'manual', NULL, NULL, NULL, 'active', 420);

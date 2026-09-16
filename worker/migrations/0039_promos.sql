-- Рекламные карточки в ленте смен.
--
-- Картинка лежит BLOB'ом прямо здесь — как аватарки и галереи (см.
-- lib/media.ts): отдельное хранилище ради нескольких изображений заводить
-- незачем, а раздаётся она тем же способом, через /media/promos/:id/image.
--
-- Показы и клики считаются с первого дня намеренно. Задним числом они не
-- восстанавливаются, а первый же партнёр спросит, сколько было переходов,
-- и без ответа продавать размещение нечего.
CREATE TABLE promos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Что видит человек.
  title TEXT NOT NULL,
  text TEXT NOT NULL DEFAULT '',
  cta_label TEXT NOT NULL DEFAULT 'Открыть',
  image_data BLOB,
  image_content_type TEXT,

  -- Куда ведёт. kind решает способ открытия: ссылки t.me открываются
  -- через openTelegramLink и остаются внутри Telegram, всё остальное —
  -- через openLink. Открыть t.me как обычную ссылку значит выкинуть
  -- человека в браузер из приложения, в котором он сидит.
  url TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'telegram', -- 'telegram' | 'site'

  -- Кто рекламодатель. Для своего канала не нужно, для платного
  -- размещения — обязательная подпись на карточке.
  advertiser TEXT NOT NULL DEFAULT '',
  -- Токен маркировки рекламы. Пустой для саморекламы; заполняется, когда
  -- размещение платное.
  erid TEXT NOT NULL DEFAULT '',

  -- Показывать или нет. 'active' | 'paused'. Приостановка отличается от
  -- удаления тем, что сохраняет накопленную статистику — партнёр может
  -- вернуться, и историю показов терять не хочется.
  status TEXT NOT NULL DEFAULT 'paused',
  starts_at TEXT,
  ends_at TEXT,

  -- Частота. every_n — через сколько просмотренных смен показывать,
  -- daily_cap — потолок показов одному человеку в сутки. Без потолка
  -- человек, пролиставший сотню смен, получил бы четырнадцать реклам за
  -- вечер. weight решает, кого показывать чаще, когда активных несколько.
  every_n INTEGER NOT NULL DEFAULT 7,
  daily_cap INTEGER NOT NULL DEFAULT 3,
  weight INTEGER NOT NULL DEFAULT 1,

  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,

  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_promos_status ON promos(status);

-- Сколько раз этот человек уже видел рекламу сегодня. Нужна для
-- daily_cap: без неё потолок пришлось бы считать на клиенте, где его
-- сбрасывает любая перезагрузка приложения.
CREATE TABLE promo_views (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  promo_id INTEGER NOT NULL REFERENCES promos(id) ON DELETE CASCADE,
  worker_id INTEGER NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  shown INTEGER NOT NULL DEFAULT 0,
  clicked INTEGER NOT NULL DEFAULT 0,
  UNIQUE (promo_id, worker_id, day)
);

CREATE INDEX idx_promo_views_worker_day ON promo_views(worker_id, day);

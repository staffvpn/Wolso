# wolso-api

Бэкенд Wolso: Cloudflare Workers + Hono, D1 (SQLite) как база, R2 —
хранилище файлов (документы работников). Обслуживает и мобильное
Mini App (`../src`), и админ-панель (`../admin`).

## Что нужно один раз

- Аккаунт Cloudflare, `wrangler` (уже в `devDependencies`, ставится через
  `npm install`).
- Telegram-бот от @BotFather — токен и username.
- Свой numeric Telegram ID (узнать у @userinfobot) — им бутстрапится
  первый аккаунт с ролью Owner в админке.

## 1. Установка и логин

```bash
cd worker
npm install
npx wrangler login
```

## 2. Создать D1

```bash
npx wrangler d1 create wolso
```

Скопируйте `database_id` из вывода команды в `wrangler.toml`
(`[[d1_databases]] database_id = "..."`).

R2 не нужен — документы работников хранятся прямо в D1 (см.
`migrations/0005_document_blob_storage.sql`), потому что R2 требует
подключить биллинг даже на бесплатном тарифе, а это доступно не всем.

## 3. Прогнать миграции

Локально (для `wrangler dev`):

```bash
npm run db:migrate:local
```

На проде:

```bash
npm run db:migrate:remote
```

Каждая новая миграция в `migrations/` (например, при обновлении Wolso)
применяется той же командой — `wrangler` сам понимает, что уже накатано.

## 4. Секреты

```bash
npx wrangler secret put BOT_TOKEN
# токен бота от @BotFather, как есть

npx wrangler secret put SESSION_SECRET
# любая длинная случайная строка, например: openssl rand -hex 32

npx wrangler secret put OWNER_TELEGRAM_ID
# ваш numeric Telegram ID — с ним первый вход в админку через Telegram
# Login Widget создаст запись с ролью Owner. Остальных сотрудников
# приглашает уже Owner из раздела «Пользователи» админки.
```

## 5. CORS-адреса

В `wrangler.toml` `[vars]` — `APP_ORIGIN` (мобильное Mini App) и
`ADMIN_ORIGIN` (админка). Проставьте туда реальные адреса Cloudflare
Pages (или свой домен) до деплоя — иначе браузер срежет запросы по CORS.

## 6. Деплой

```bash
npm run deploy
# то же самое, что: npx wrangler deploy
```

Команда выведет URL воркера (`https://wolso-api.<account>.workers.dev`,
или ваш кастомный домен, если подключён). Он нужен обоим фронтендам как
`VITE_API_URL`.

## Настройка фронтендов

В `../` (мобильное приложение) и `../admin` — по `.env.example`. Скопируйте
в `.env` и заполните:

```
VITE_API_URL=https://wolso-api.<account>.workers.dev
```

В админке дополнительно:

```
VITE_BOT_USERNAME=your_bot_username
```

Плюс у бота в @BotFather нужно выполнить `/setdomain` и указать домен,
на котором будет открываться админка (например,
`wolso-admin.pages.dev`) — без этого Telegram Login Widget откажется
авторизовывать пользователей на этом домене.

При деплое на Cloudflare Pages эти переменные задаются в настройках
проекта (Settings → Environment variables) под теми же именами.

## Локальная разработка

```bash
npm run dev
# wrangler dev, поднимает воркер на http://localhost:8787
```

Мобильному и админ-приложению для локальной разработки нужен
`VITE_API_URL=http://localhost:8787` в их `.env`.

## Структура

```
src/
  index.ts           точка входа, CORS, роутинг
  types.ts           Env, типы сессии, ключи прав
  lib/
    telegramAuth.ts   проверка initData (Mini App) и Login Widget (админка)
    session.ts        подписанные токены сессии
    db.ts             общие SQL-хелперы (JOIN смены+компания и т.д.)
  middleware/auth.ts  attachSession, requireWorker/Company/Staff, requirePermission
  routes/             API для мобильного приложения (смены, отклики, чаты, ...)
  admin/              API для админки (модерация, пользователи, роли, аудит-лог, дашборд)
migrations/           схема D1, по порядку
```

## Данные, которых пока нет по-настоящему

Всё, что связано с деньгами (кошелёк работника, выплаты, комиссия
платформы) сознательно не реализовано — см. `FEATURES.payments` в обоих
фронтендах. UI на месте, скрыт флагом; бэкенд-роутов под это нет. Когда
подключится платёжный провайдер, эта часть достраивается отдельно.

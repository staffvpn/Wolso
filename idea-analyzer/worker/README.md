# idea-analyzer-api

Бэкенд «Разнеси мою идею»: Cloudflare Workers + Hono, D1 (SQLite) как база.
Отдельный сервис от `../../worker` (Wolso) — свой D1, свой бот, ничего не
делят.

## Что нужно один раз

- Аккаунт Cloudflare, `wrangler` (уже в `devDependencies`).
- Отдельный Telegram-бот от @BotFather — токен и username. Через
  `/newapp` в BotFather привяжите к нему Mini App с URL будущего фронтенда.

## 1. Установка и логин

```bash
cd worker
npm install
npx wrangler login
```

## 2. Создать D1

```bash
npx wrangler d1 create idea-analyzer
```

Скопируйте `database_id` из вывода в `wrangler.toml`.

## 3. Прогнать миграции

```bash
npm run db:migrate:local    # для wrangler dev
npm run db:migrate:remote   # на проде
```

## 4. Секреты

```bash
npx wrangler secret put BOT_TOKEN
# токен бота от @BotFather, как есть

npx wrangler secret put WEBHOOK_SECRET
# любая случайная строка, например: openssl rand -hex 32
# используется, чтобы отличить настоящий вызов от Telegram от чужого POST

npx wrangler secret put ANTHROPIC_API_KEY
# опционально. Без него /analyze использует встроенный генератор-заглушку
# (см. src/lib/analysis.ts) — приложение всё равно полностью работает,
# просто разбор менее умный. С ключом — реальный вызов Claude API.
```

## 5. Деплой

```bash
npm run deploy
```

Выведет URL воркера — он нужен фронтенду как `VITE_API_URL` (см.
`../.env.example`).

## 6. Оплата: Telegram Stars

Монетизация («79 ⭐ за разбор» / «Pro за 249 ⭐/мес») идёт через
[Telegram Stars](https://core.telegram.org/bots/payments-stars) — это
единственная валюта, которой можно продавать цифровой товар в Mini App
без отдельного эквайринга. Рублёвая цена из ТЗ (79 ₽) переведена в звёзды
1:1 по номиналу — при желании поменяйте суммы в `src/routes/payments.ts`
(`OFFERS`).

Чтобы платежи доходили до бота, один раз пропишите вебхук:

```bash
curl -X POST https://api.telegram.org/bot<BOT_TOKEN>/setWebhook \
  -d url=https://<ваш-воркер>/telegram/webhook \
  -d secret_token=<тот же WEBHOOK_SECRET>
```

Дальше всё автоматически: `POST /payments/invoice` создаёт ссылку на
оплату, клиент открывает её через `Telegram.WebApp.openInvoice`,
`/telegram/webhook` подтверждает списание и начисляет разбор или Pro.

## Структура

```
src/
  index.ts            точка входа, CORS, роутинг
  types.ts            Env, доменные типы (Mode, AnalysisResult, ...)
  lib/
    telegramAuth.ts     проверка initData Mini App
    users.ts            getOrCreateUser, расчёт entitlement (бесплатно/⭐/Pro)
    analysis.ts         генерация разбора: Claude API + офлайн-заглушка
    stars.ts            createInvoiceLink, answerPreCheckoutQuery, sendMessage
  middleware/auth.ts    requireTelegramUser — проверяет X-Init-Data на каждый запрос
  routes/
    me.ts               GET /me — текущий баланс разборов
    analyze.ts           POST /analyze — сам разбор идеи
    history.ts           GET /history, GET /history/:id
    payments.ts          POST /payments/invoice — ссылка на оплату звёздами
    webhook.ts            POST /telegram/webhook — pre_checkout_query, successful_payment
migrations/            схема D1
```

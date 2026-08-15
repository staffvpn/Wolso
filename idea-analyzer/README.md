# Разнеси мою идею

Telegram Mini App: человек в паре предложений описывает бизнес-идею,
приложение жёстко (или не очень — на выбор) разбирает её по фактам.

Четыре режима разбора: **Хвалить 😊 / Критиковать 🤔 / Уничтожить 🔥 /
Найди способ заработать 💰**. Для каждой идеи разбор всегда включает:
кому это нужно, почему могут не купить, конкуренты, слабые места, что
проверить до запуска, пример юнит-экономики и 5 способов сделать идею
лучше.

Отдельный продукт от Wolso (свайп-биржи смен, лежащей в корне этого
репозитория) — своё приложение, свой бэкенд, свой бот. Общая только
техническая база: те же React/Vite/Tailwind/Cloudflare-конвенции.

## Стек

- **React 19 + TypeScript + Vite**
- **Tailwind CSS v4** — тёмная тема с фиолетово-розовым брендом, токены в
  `src/index.css`
- **Framer Motion** — анимации: загрузка-«раздумье», шторка оплаты, счётчик
- **Zustand** — состояние (`src/store`)
- **React Router (Hash Router)**
- Иллюстрации — инлайновые SVG (`src/components/illustrations`), без
  внешних ассетов

## Бэкенд

Cloudflare Workers + D1, лежит в `worker/` — свой сервис, не путать с
`../worker` (это бэкенд Wolso). Инструкция по деплою и настройке оплаты
звёздами Telegram — в `worker/README.md`. Локально нужен `.env` с
`VITE_API_URL` (см. `.env.example`).

## Как работает разбор идеи

`worker/src/lib/analysis.ts`: если задан секрет `ANTHROPIC_API_KEY`,
разбор генерирует Claude (модель `claude-sonnet-5`) по строгой JSON-схеме,
с системным промптом под выбранный режим. Без ключа — встроенный
детерминированный генератор-заглушка (тот же формат ответа, тексты
шаблонные) — так продукт полностью работает «из коробки» без внешних
интеграций, а настоящий ИИ включается одной командой `wrangler secret put`.

## Монетизация

1 бесплатный разбор → дальше 79 ⭐ за разбор или Pro (249 ⭐/мес,
безлимит). Оплата — [Telegram Stars](https://core.telegram.org/bots/payments-stars),
единственная валюта, которой можно продавать цифровой товар в Mini App
без подключения эквайринга. Подробности и настройка вебхука — в
`worker/README.md`.

`src/store/useEntitlementStore.ts` хранит текущий баланс (бесплатный
разбор / звёзды / Pro), `src/store/usePaywallStore.ts` — открытие шторки
оплаты и сам вызов `Telegram.WebApp.openInvoice`.

## Telegram Mini App

`index.html` подключает `telegram-web-app.js`, `src/lib/telegram.ts`
инициализирует SDK при старте: `ready()`, `expand()`, `requestFullscreen()`,
синхронизация цветов хедера/фона с тёмной темой. Всё обёрнуто в проверки
на `window.Telegram` — приложение работает и как обычный сайт при
разработке (кроме реальной оплаты — её можно проверить только внутри
Telegram).

## Разработка

```bash
npm install
npm run dev      # локальный сервер с HMR
npm run build    # tsc -b && vite build
npm run lint      # oxlint
```

Для проверки внутри Telegram нужен HTTPS-туннель (ngrok / cloudflared) до
`npm run dev` и Mini App, настроенный в @BotFather на этот URL.

## Структура

```
src/
  components/
    ui/              Button, BottomSheet, Card, Chip — общий UI-кит
    illustrations/    инлайновые SVG-иллюстрации (герой, загрузка, пустая история)
    ModePicker, ScoreGauge, SectionCard, TopBar, PaywallSheet, LoadingOverlay
  screens/           Home / Result / History
  store/             zustand-сторы: entitlement, analysis, paywall
  data/              modes.ts (4 режима), examples.ts (плейсхолдеры)
  lib/               telegram.ts, apiClient.ts, cn(), format()
worker/              Cloudflare Worker API — см. worker/README.md
```

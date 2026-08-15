# Wolso

Свайп-биржа смен для Telegram Mini App: работник листает карточки смен и
откликается свайпом вправо, работодатель тем же жестом разбирает кандидатов.
Два режима (работник / работодатель) в одном приложении, переключаются в
настройках профиля.

## Стек

- **React 19 + TypeScript + Vite**
- **Tailwind CSS v4** — тёмная тема, токены в `src/index.css`
- **Framer Motion** — вся анимация: свайп-карточки, переходы, bottom sheet
- **Zustand** — состояние (`src/store`), с `persist` там, где нужно пережить перезапуск
- **React Router (Hash Router)** — хэш-роутинг, чтобы приложение работало на любом статическом хостинге без серверных rewrite-правил
- **lucide-react** — иконки

## Бэкенд

Реальный API — Cloudflare Workers + D1 + R2, лежит в `../worker` (общий
для этого приложения и `../admin`). Инструкция по деплою — в
`../worker/README.md`. Локально нужен `.env` с `VITE_API_URL` (см.
`.env.example`), указывающим на поднятый воркер (`wrangler dev` или
задеплоенный).

`src/services/*Api.ts` — тонкий слой поверх `src/lib/apiClient.ts`
(fetch + Bearer-токен сессии), экраны и сторы работают только через него.
`src/store/useAuthStore.ts` обменивает Telegram `initData` на токены при
старте (`AuthGate` блокирует рендер приложения до этого момента).

## Telegram Mini App

`index.html` подключает `telegram-web-app.js`, `src/lib/telegram.ts`
инициализирует SDK при старте (`bootstrapTelegram()` в `main.tsx`):
`ready()`, `expand()`, `requestFullscreen()`, отключение вертикальных
свайпов, синхронизация цветов хедера/фона с тёмной темой. Всё обёрнуто в
проверки на `window.Telegram` — приложение прекрасно работает и как обычный
сайт при разработке.

## Платные функции

Сознательно не реализованы, но заложены на архитектурном уровне:

- `src/store/useEntitlementsStore.ts` — `isPro: false` жёстко зашито,
  плюс `openPaywall(feature)` / `PaywallSheet` — единая точка входа для
  любого будущего платного действия (буст отклика, отмена свайпа,
  безлимит и т.д.). Сейчас показывает шторку «скоро».
- Кнопка буста (🚀) на карточке смены и «вернуть свайп» уже на своих местах
  в UI — просто открывают paywall-заглушку.

Когда будет готова монетизация (Telegram Stars или подписка), меняется
только источник `isPro` и логика внутри `openPaywall` — экраны трогать не
придётся.

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
  components/    UI-кит, свайп-дек, шторки, нав-бар
  screens/       экраны по ролям: onboarding / worker / employer / shared
  store/         zustand-сторы, дергают services/*
  services/      обёртки над apiClient.ts (реальные запросы к воркеру)
  data/          позиции/цвета логотипов и т.п. — статические справочники,
                 не бизнес-данные
  lib/           telegram.ts, apiClient.ts, features.ts, форматирование, cn()
```

## Другие приложения в репозитории

- **`idea-analyzer/`** — «Разнеси мою идею», отдельный Telegram Mini App
  для разбора бизнес-идей (не связан с Wolso). Свой фронтенд, свой
  Cloudflare Worker, своя монетизация через Telegram Stars — см.
  `idea-analyzer/README.md`.

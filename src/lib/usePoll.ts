import { useEffect, useRef } from 'react';

/** Периодический опрос, пока экран открыт и виден.
 *
 *  Нужен там, где данные меняет не этот человек, а другой: переписка
 *  обновлялась только при входе в чат, поэтому ответ собеседника появлялся
 *  на экране лишь после выхода и повторного захода. Внутри Telegram
 *  постоянного соединения у мини-аппа нет, а Durable Objects ради чата на
 *  два человека — отдельная инфраструктура; опрос раз в пару секунд даёт
 *  ту же скорость и ничего не стоит, пока экран действительно открыт.
 *
 *  Свёрнутое приложение не опрашивает ничего: таймер снимается по
 *  visibilitychange и заводится обратно вместе с немедленным запросом —
 *  вернувшись в чат, человек видит новое сразу, а не через полный
 *  интервал. Один запрос за раз: медленная сеть не должна копить очередь
 *  из перекрывающихся опросов. */
export function usePoll(fn: () => void | Promise<unknown>, intervalMs: number, enabled = true) {
  const saved = useRef(fn);
  saved.current = fn;

  useEffect(() => {
    if (!enabled) return;

    let timer: ReturnType<typeof setInterval> | null = null;
    let inFlight = false;

    async function tick() {
      if (inFlight || document.hidden) return;
      inFlight = true;
      try {
        await saved.current();
      } catch {
        // Провалившийся опрос — это одна пропущенная итерация, а не повод
        // останавливать обновление: сеть в метро отваливается и возвращается.
      } finally {
        inFlight = false;
      }
    }

    function start() {
      if (timer === null) timer = setInterval(tick, intervalMs);
    }
    function stop() {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    }

    function onVisibility() {
      if (document.hidden) {
        stop();
      } else {
        void tick();
        start();
      }
    }

    start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [intervalMs, enabled]);
}

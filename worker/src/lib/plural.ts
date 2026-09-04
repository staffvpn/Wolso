/** Русское склонение по числу: 1 сообщение, 2 сообщения, 5 сообщений.
 *  Та же функция, что и в приложении (src/lib/format.ts) — сообщения бота
 *  пишутся на сервере, и «5 непрочитанных сообщения» в пуше выглядит
 *  ровно так же плохо, как на экране. */
export function pluralize(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

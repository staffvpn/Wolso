import type { Env } from '../types';

/** Ставка в час или сумма за смену — что из них назвал работодатель.
 *
 *  В базе всегда лежит и то и другое: hourly_rate и total_pay заполняются
 *  обе независимо от режима, поэтому фильтр ленты по ставке, статистика и
 *  выгрузки работают, не заглядывая сюда. pay_mode отвечает на другой
 *  вопрос — что человек ввёл, а что посчиталось, — и нужен ровно двум
 *  вещам: показать в карточке главным то число, о котором договорились, и
 *  подставить его же обратно в форму при редактировании. */
export type PayMode = 'hourly' | 'fixed';

export function asPayMode(value: unknown): PayMode {
  return value === 'fixed' ? 'fixed' : 'hourly';
}

/** Считает недостающее из введённого. Час стоит `hourly`, смена целиком —
 *  `total`; какое из двух чисел пришло от работодателя, решает режим.
 *
 *  Часы могут быть нулевыми или отрицательными (смена «с 22 до 6» — ночная,
 *  её длительность формой пока не считается), и делить на такое нельзя:
 *  в этом случае ставка равна сумме за смену, что честнее нуля и не роняет
 *  запрос. */
export function derivePay(mode: PayMode, entered: number, hours: number): { hourlyRate: number; totalPay: number } {
  const value = Math.max(0, Math.round(entered));
  if (mode === 'fixed') {
    return { totalPay: value, hourlyRate: hours > 0 ? Math.round(value / hours) : value };
  }
  return { hourlyRate: value, totalPay: hours > 0 ? Math.round(value * hours) : value };
}

/** Применена ли миграция 0036. Как и везде: миграции накатываются руками,
 *  и запрос к несуществующему столбцу превращается в голый internal_error
 *  500 — здесь это была бы вся публикация смен разом. */
let confirmed = false;

export async function payModeColumnExists(env: Env): Promise<boolean> {
  if (confirmed) return true;
  try {
    const { results } = await env.DB.prepare('PRAGMA table_info(shifts)').all<{ name: string }>();
    confirmed = results.some((r) => r.name === 'pay_mode');
    return confirmed;
  } catch {
    return false;
  }
}

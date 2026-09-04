import type { Env } from '../types';

/** Своё фото против фото из Telegram.
 *
 *  При регистрации в анкету копируется `photo_url` — картинка, которая
 *  стоит у человека в Telegram. Формально фото после этого есть у всех, и
 *  именно поэтому его никто не меняет: анкета выглядит заполненной. А
 *  работодатель в ленте кандидатов выбирает по лицу, и машина, кот или
 *  пейзаж вместо лица стоят человеку смен, о чём он не догадывается.
 *
 *  Загруженное фото лежит в `avatar_data`; `photo_url` — это чужая
 *  картинка, за которую Wolso не отвечает (Telegram может её сменить или
 *  убрать в любой момент). Отсюда правило: «своё фото» = avatar_data. */
export async function hasOwnPhoto(env: Env, workerId: number): Promise<boolean> {
  const row = await env.DB.prepare('SELECT (avatar_data IS NOT NULL) as own FROM workers WHERE id = ?')
    .bind(workerId)
    .first<{ own: number }>();
  return !!row?.own;
}

/** Применена ли миграция 0035. Как и везде: миграции накатываются руками,
 *  а этот столбец читает крон — в фоне, где никто не смотрит на ошибку. */
let confirmed = false;

export async function photoReminderColumnExists(env: Env): Promise<boolean> {
  if (confirmed) return true;
  try {
    const { results } = await env.DB.prepare('PRAGMA table_info(workers)').all<{ name: string }>();
    confirmed = results.some((r) => r.name === 'photo_reminded_at');
    return confirmed;
  } catch {
    return false;
  }
}

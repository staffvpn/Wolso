/** Лимитеры Cloudflare (см. wrangler.toml, [[ratelimits]]) — срабатывают на
 *  границе сети, до воркера и без единого обращения к D1. Специально на
 *  случай направленного флуда: обычный lib/rateLimit.ts считает по
 *  строкам в самой базе, а при флуде именно чтения базы и есть узкое
 *  место, которое хочется не трогать вообще. */

/** Cloudflare сама подставляет этот заголовок на границе сети — что бы ни
 *  прислал клиент в запросе, значение всегда переписывается реальным IP,
 *  подделать его нельзя. */
function clientIp(req: Request): string {
  return req.headers.get('CF-Connecting-IP') ?? 'unknown';
}

/** true — можно пускать дальше. Best-effort: если сам лимитер недоступен
 *  (сбой инфраструктуры Cloudflare), не блокируем запрос — это защита от
 *  флуда, а не повод положить весь API самим. */
export async function withinLimit(limiter: RateLimit, req: Request, keyPrefix = ''): Promise<boolean> {
  try {
    const { success } = await limiter.limit({ key: `${keyPrefix}:${clientIp(req)}` });
    return success;
  } catch (err) {
    console.error('edge rate limiter threw', err);
    return true;
  }
}

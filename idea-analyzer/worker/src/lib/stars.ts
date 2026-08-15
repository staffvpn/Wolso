import type { Env } from '../types';

/** Telegram Stars ("XTR") is the only currency Telegram lets Mini Apps
 *  charge for digital goods without a separate payment-provider account —
 *  so "79 ₽ за анализ" ships as "79 ⭐", same idea, no extra integration
 *  needed beyond the bot token this product already requires.
 *  https://core.telegram.org/bots/payments-stars */
export async function createStarsInvoiceLink(
  env: Env,
  opts: { title: string; description: string; payload: string; amount: number },
): Promise<string> {
  const res = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/createInvoiceLink`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: opts.title,
      description: opts.description,
      payload: opts.payload,
      currency: 'XTR',
      prices: [{ label: opts.title, amount: opts.amount }],
    }),
  });
  const data = await res.json<{ ok: boolean; result?: string; description?: string }>();
  if (!data.ok || !data.result) throw new Error(data.description ?? 'invoice_link_failed');
  return data.result;
}

export async function answerPreCheckoutQuery(env: Env, id: string, ok: boolean, errorMessage?: string): Promise<void> {
  await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/answerPreCheckoutQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pre_checkout_query_id: id, ok, error_message: errorMessage }),
  }).catch((err) => console.error('answerPreCheckoutQuery failed', err));
}

export async function sendTelegramMessage(env: Env, chatId: number, text: string): Promise<void> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    if (!res.ok) console.error('telegram sendMessage failed', chatId, res.status, await res.text().catch(() => ''));
  } catch (err) {
    console.error('telegram sendMessage threw', chatId, err);
  }
}

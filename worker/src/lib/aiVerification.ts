import Anthropic from '@anthropic-ai/sdk';
import type { Env } from '../types';

interface CompanyForVerification {
  id: number;
  name: string;
  inn: string | null;
  city: string;
  address: string | null;
}

/** Best-effort research aid for the human moderator — asks Claude to search
 *  the web and report what it can find about whether this looks like a real,
 *  operating legal entity (ИНН plausibility, name match, signs of an actual
 *  business vs. a shell/mass-registration address). It never approves or
 *  rejects anything itself; the admin always makes that call in the
 *  dashboard. Returns null (and logs) on any failure, including a missing
 *  API key, so the moderation queue still works purely by hand when there's
 *  nothing configured. */
export async function verifyCompanyWithAI(env: Env, company: CompanyForVerification): Promise<string | null> {
  if (!env.ANTHROPIC_API_KEY) {
    console.warn('ANTHROPIC_API_KEY not set — skipping AI verification for company', company.id);
    return null;
  }

  try {
    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    const prompt = [
      'Проверь в открытых источниках, похоже ли это на реально существующее российское юридическое лицо или ИП:',
      '',
      `Название: ${company.name}`,
      `ИНН: ${company.inn ?? 'не указан'}`,
      `Город: ${company.city || 'не указан'}`,
      company.address ? `Адрес: ${company.address}` : '',
      '',
      'Поищи по ИНН и названию (реестр ФНС/ЕГРЮЛ-ЕГРИП, картотека арбитражных дел, обычный веб-поиск).',
      'Кратко, на русском, в 3-5 предложениях изложи, что удалось найти: подтверждается ли ИНН и совпадает ли он с этим названием,',
      'есть ли признаки действующего бизнеса (сайт, отзывы, упоминания), и есть ли что-то настораживающее',
      '(массовый адрес регистрации, недавно ликвидирована/в процессе банкротства, ИНН не находится или относится к другой организации и т.п.).',
      'Не выноси вердикт "одобрить" или "отклонить" — просто изложи факты, которые нашёл, для модератора-человека, который примет решение сам.',
    ]
      .filter(Boolean)
      .join('\n');

    const response = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 1024,
      tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 3 }],
      messages: [{ role: 'user', content: prompt }],
    });

    let text = '';
    for (const block of response.content) {
      if (block.type === 'text') text += block.text;
    }
    return text.trim() || null;
  } catch (err) {
    console.error('AI verification failed for company', company.id, err);
    return null;
  }
}

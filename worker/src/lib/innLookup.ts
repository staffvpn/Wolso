interface CompanyForLookup {
  id: number;
  name: string;
  inn: string | null;
}

interface EgrulSearchStart {
  t?: string;
}

interface EgrulSearchRow {
  // Field names for этот internal, undocumented nalog.ru endpoint are
  // reconstructed from public reverse-engineering write-ups, not an
  // official spec — kept loose (unknown) and read defensively below so a
  // renamed/added field never throws, just degrades to raw JSON.
  [key: string]: unknown;
}

interface EgrulSearchResult {
  rows?: EgrulSearchRow[];
}

const UA = 'Mozilla/5.0 (compatible; WolsoVerify/1.0; +https://wolso.app)';

function firstString(row: EgrulSearchRow, keys: string[]): string | null {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

/** Looks a company up directly in the official, free ЕГРЮЛ/ЕГРИП registry
 *  (egrul.nalog.ru — the tax service's own public search) instead of
 *  asking an LLM to research it — no API key, no per-request cost. This is
 *  the site's internal search endpoint, not a documented public API: it
 *  can change shape or start blocking datacenter traffic without notice,
 *  so every step degrades to a plain, honest "couldn't check automatically"
 *  message rather than throwing. Purely informational for the moderator —
 *  it never approves or rejects anything itself. */
export async function lookupInn(company: CompanyForLookup): Promise<string | null> {
  if (!company.inn) return null;

  try {
    const startRes = await fetch('https://egrul.nalog.ru/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
      body: new URLSearchParams({ query: company.inn, region: '', PreventChromeAutocomplete: '' }).toString(),
    });
    if (!startRes.ok) {
      return `Не удалось обратиться к egrul.nalog.ru (код ${startRes.status}) — проверьте ИНН ${company.inn} вручную на сайте ФНС.`;
    }
    const start = await startRes.json<EgrulSearchStart>();
    if (!start.t) {
      return `egrul.nalog.ru не вернул поисковый токен — проверьте ИНН ${company.inn} вручную на сайте ФНС.`;
    }

    let rows: EgrulSearchRow[] | undefined;
    for (let attempt = 0; attempt < 8; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 900));
      const pollRes = await fetch(`https://egrul.nalog.ru/search-result/${start.t}`, { headers: { 'User-Agent': UA } });
      if (!pollRes.ok) continue;
      const data = await pollRes.json<EgrulSearchResult>();
      if (data.rows) {
        rows = data.rows;
        break;
      }
    }

    if (!rows) {
      return `egrul.nalog.ru не успел ответить — попробуйте ещё раз или проверьте ИНН ${company.inn} вручную на сайте ФНС.`;
    }
    if (rows.length === 0) {
      return `ИНН ${company.inn} не найден в ЕГРЮЛ/ЕГРИП — либо опечатка в номере, либо организации с таким ИНН нет в реестре ФНС.`;
    }

    const row = rows[0];
    const officialName = firstString(row, ['n', 'name', 'org_name', 'title']);
    const ogrn = firstString(row, ['o', 'c', 'ogrn']);
    const terminated = firstString(row, ['e', 'end_date', 'liquidation_date']);

    if (!officialName) {
      // Field names guessed above didn't match — hand the moderator the
      // raw row rather than a broken-looking empty summary.
      return `Запись по ИНН ${company.inn} найдена в ЕГРЮЛ/ЕГРИП, но формат ответа изменился и разобрать поля не удалось. Данные реестра: ${JSON.stringify(row).slice(0, 500)}`;
    }

    return [
      `Найдено в ЕГРЮЛ/ЕГРИП по ИНН ${company.inn}:`,
      `Официальное название: ${officialName}`,
      ogrn ? `ОГРН/ОГРНИП: ${ogrn}` : '',
      terminated ? `⚠️ По данным реестра деятельность прекращена: ${terminated}` : 'Статус: действующая (данных о ликвидации в реестре нет)',
      `Название в анкете: «${company.name}»${officialName.toLowerCase().includes(company.name.toLowerCase()) || company.name.toLowerCase().includes(officialName.toLowerCase()) ? '' : ' — не совпадает с официальным, стоит уточнить'}`,
    ]
      .filter(Boolean)
      .join('\n');
  } catch (err) {
    console.error('EGRUL lookup failed for company', company.id, err);
    return null;
  }
}

import type { AnalysisResult, Env, Mode } from '../types';

const MODEL = 'claude-sonnet-5';

const MODE_SYSTEM_TONE: Record<Mode, string> = {
  praise:
    'Ты — воодушевляющий бизнес-ментор. Ты веришь в идею и разбираешь её с оптимизмом, но честно: подсвечиваешь реальные сильные стороны и мягко — риски, которые всё равно нужно закрыть.',
  criticize:
    'Ты — трезвый бизнес-аналитик и венчурный консультант. Ты разбираешь идею объективно и по фактам, без прикрас, но конструктивно — цель дать пользу, а не унизить.',
  destroy:
    'Ты — беспощадный циничный инвестор, который повидал тысячи питчей и не щадит слабые идеи. Пиши максимально жёстко, дерзко, с сарказмом, но по существу и без выдуманных фактов.',
  monetize:
    'Ты — эксперт по монетизации и бизнес-моделям. Твой фокус — деньги: как на идее заработать, какие модели монетизации, апсейлы и ниши принесут максимум прибыли.',
};

const SYSTEM_SCHEMA = `Ты разбираешь бизнес-идеи для мини-приложения в Telegram "Разнеси мою идею". Всегда отвечай ТОЛЬКО валидным JSON без markdown-обёртки и пояснений вне JSON, строго по схеме:
{
  "verdict": string,          // заголовок-вывод одной фразой, в тональности режима
  "score": number,            // целое 0-100, реалистичная оценка потенциала идеи
  "scoreLabel": string,       // короткая подпись к оценке, 2-4 слова
  "audience": string[],       // 3-5 пунктов: кому это реально нужно
  "risks": string[],          // 3-5 пунктов: почему могут не купить/не воспользоваться
  "competitors": string[],    // 3-5 пунктов: реальные или типовые конкуренты/альтернативы на рынке
  "weaknesses": string[],     // 3-5 пунктов: слабые места самой идеи
  "checklist": string[],      // 3-5 пунктов: что проверить/протестировать до запуска
  "economics": [{"label": string, "value": string}], // 4-6 строк примерной юнит-экономики с конкретными числами в рублях (выручка, издержки, маржа, точка безубыточности и т.п.)
  "improvements": string[]    // РОВНО 5 пунктов: конкретные способы сделать идею лучше
}
Пиши по-русски, конкретно, без воды, используй цифры там, где уместно. Каждый пункт — отдельная законченная мысль, 1-2 предложения.`;

export async function generateAnalysis(env: Env, idea: string, mode: Mode): Promise<AnalysisResult> {
  if (env.ANTHROPIC_API_KEY) {
    try {
      return await callClaude(env, idea, mode);
    } catch (err) {
      console.error('claude analysis failed, falling back to heuristic generator', err);
    }
  }
  return heuristicAnalysis(idea, mode);
}

async function callClaude(env: Env, idea: string, mode: Mode): Promise<AnalysisResult> {
  const system = `${MODE_SYSTEM_TONE[mode]}\n\n${SYSTEM_SCHEMA}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2000,
      system,
      messages: [{ role: 'user', content: `Идея: ${idea}` }],
    }),
  });

  if (!res.ok) throw new Error(`claude_http_${res.status}: ${await res.text().catch(() => '')}`);

  const data = await res.json<{ content: { type: string; text?: string }[] }>();
  const text = data.content.find((b) => b.type === 'text')?.text ?? '';
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('no_json_in_claude_response');

  return normalize(JSON.parse(match[0]));
}

/** Guards against a malformed/partial LLM response taking down the route —
 *  clamps and defaults every field instead of trusting the shape blindly. */
function normalize(raw: unknown): AnalysisResult {
  const r = raw as Omit<Partial<AnalysisResult>, 'economics'> & { economics?: unknown };
  const strArr = (v: unknown, fallback: string[]): string[] => {
    if (!Array.isArray(v)) return fallback;
    const items = v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
    return items.length ? items : fallback;
  };
  const economics = Array.isArray(r.economics)
    ? r.economics
        .filter((e): e is Record<string, unknown> => typeof e === 'object' && e !== null)
        .map((e) => ({ label: String(e.label ?? ''), value: String(e.value ?? '') }))
        .filter((e) => e.label && e.value)
    : [];

  return {
    verdict: typeof r.verdict === 'string' && r.verdict ? r.verdict : 'Разбор готов',
    score: clampScore(r.score),
    scoreLabel: typeof r.scoreLabel === 'string' && r.scoreLabel ? r.scoreLabel : 'Есть о чём подумать',
    audience: strArr(r.audience, ['Не удалось определить аудиторию точно — уточните идею']),
    risks: strArr(r.risks, ['Недостаточно деталей, чтобы оценить риски']),
    competitors: strArr(r.competitors, ['Прямых аналогов не найдено']),
    weaknesses: strArr(r.weaknesses, ['Опишите идею подробнее для точного разбора']),
    checklist: strArr(r.checklist, ['Проверьте спрос на малой группе клиентов перед запуском']),
    economics: economics.length ? economics : [{ label: 'Данных недостаточно', value: '—' }],
    improvements: strArr(r.improvements, ['Опишите идею подробнее для конкретных советов']).slice(0, 5),
  };
}

function clampScore(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return 50;
  return Math.max(0, Math.min(100, Math.round(n)));
}

// ---------------------------------------------------------------------------
// Fallback: rule-based generator used when ANTHROPIC_API_KEY isn't set, so
// the product works end-to-end out of the box. Not "real" AI reasoning —
// deterministic per (idea, mode) pair, mode changes tone/severity, idea text
// is woven into the templates so the result still reads as on-topic.
// ---------------------------------------------------------------------------

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function pickN<T>(rng: () => number, arr: T[], n: number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  while (out.length < Math.min(n, copy.length)) {
    const i = Math.floor(rng() * copy.length);
    out.push(copy.splice(i, 1)[0]);
  }
  return out;
}

const SCORE_RANGE: Record<Mode, [number, number]> = {
  praise: [58, 88],
  criticize: [32, 64],
  destroy: [8, 42],
  monetize: [42, 78],
};

const SCORE_LABELS: Record<Mode, string[]> = {
  praise: ['Есть реальный потенциал', 'Стоит попробовать', 'Хорошая база для старта'],
  criticize: ['Сырая, но рабочая', 'Нужна доработка', 'Половина пути пройдена'],
  destroy: ['Слабо', 'Почти безнадёжно', 'Возвращайтесь позже'],
  monetize: ['Деньги здесь есть', 'Монетизируемо', 'Можно вытащить прибыль'],
};

function verdictFor(idea: string, mode: Mode, score: number): string {
  const short = idea.length > 60 ? `${idea.slice(0, 60).trim()}…` : idea;
  const byMode: Record<Mode, string> = {
    praise: `«${short}» — идея с настоящим потенциалом, если довести детали до ума`,
    criticize: `«${short}» держится на честном слове — цифры и конкуренты решат её судьбу`,
    destroy: `«${short}» — в текущем виде это не бизнес, а красивое желание`,
    monetize: `На «${short}» реально заработать — если выбрать правильную модель`,
  };
  return score >= 70 && mode !== 'destroy' ? byMode[mode].replace('идея с', 'сильная идея с') : byMode[mode];
}

function audienceFor(idea: string, rng: () => number): string[] {
  const templates = [
    `Люди, которые уже сейчас платят за что-то похожее на «${idea}», просто у другого поставщика`,
    'Жители крупных городов 25-45 лет с доходом выше среднего — у них есть деньги и нет времени',
    'Те, кто устал от текущих альтернатив и готов попробовать новое ради удобства',
    'Небольшой процент энтузиастов-первопроходцев, которые тестируют всё новое первыми',
    'Локальная аудитория в радиусе действия — без неё юнит-экономика не сойдётся',
    'B2B-сегмент, если удастся упаковать идею как экономию времени или денег для бизнеса',
  ];
  return pickN(rng, templates, 4);
}

const RISKS_BY_MODE: Record<Mode, string[]> = {
  praise: [
    'Часть аудитории пока не знает, что ей это нужно — потребуется объяснить ценность',
    'Цена входа для первых клиентов должна быть ощутимо ниже, чем у альтернатив',
    'Доверие к новому игроку строится не сразу — нужны первые отзывы и кейсы',
    'Сезонность может ощутимо просаживать спрос в отдельные месяцы',
  ],
  criticize: [
    'Нет доказанного спроса — только предположение, что людям это нужно',
    'Цена может оказаться выше психологического порога для целевой аудитории',
    'Переключение с привычного варианта требует усилия, которое клиенты не всегда готовы приложить',
    'Слишком узкая ниша — привлечь достаточно платящих клиентов может быть дорого',
    'Нет чёткого ответа, почему выбрать именно вас, а не то, чем уже пользуются',
  ],
  destroy: [
    'Спрос вы придумали сами, никто не просил именно это решение',
    'Похожие идеи уже пытались и провалились — рынок явно намекает',
    'Экономика идеи не сойдётся при реальных издержках, а не оптимистичных прикидках',
    'Первые клиенты попробуют один раз и не вернутся — удержания нет',
    'Слишком дорого и медленно выходить на окупаемость для такой ниши',
  ],
  monetize: [
    'Модель монетизации выбрана неточно — деньги утекают мимо самой ценной аудитории',
    'Цена не откалибрована — часть выручки теряется на слишком низком чеке',
    'Нет апсейла — весь доход зависит от разовой покупки',
    'Издержки на привлечение клиента могут съесть всю маржу с первой покупки',
  ],
};

const COMPETITOR_TEMPLATES = [
  'Крупные федеральные игроки с похожим предложением и раскрученным брендом',
  'Локальные предприниматели, которые делают то же самое неформально, без бренда',
  'Смежные сервисы, которые клиент использует как компромиссную замену',
  'Маркетплейсы и агрегаторы, где можно найти похожее решение в один клик',
  '«Ничего» — привычка обходиться без этого вообще — самый опасный конкурент',
];

const WEAKNESS_BY_MODE: Record<Mode, string[]> = {
  praise: [
    'Пока не хватает истории и доверия — это решается временем и первыми клиентами',
    'Процессы ещё не отлажены под масштаб — но это нормально для старта',
    'Команде понадобится усилить один из этапов воронки продаж',
  ],
  criticize: [
    'Идея пока не отвечает на вопрос "почему сейчас" — что изменилось на рынке',
    'Нет чёткого УТП, отличающего от очевидных альтернатив',
    'Себестоимость выше, чем закладывается интуитивно, без реального расчёта',
    'Масштабирование потребует ресурсов, которых на старте скорее всего не будет',
  ],
  destroy: [
    'Идея решает проблему, которой почти ни у кого нет',
    'Экономика не работает при честном подсчёте всех издержек',
    'Барьер входа для конкурентов слишком низкий — вас скопируют за месяц',
    'Нет ни одного элемента, который нельзя было бы просто скопировать',
  ],
  monetize: [
    'Единственный источник дохода — это риск, если он просядет',
    'Нет данных о LTV клиента, чтобы понять, сколько реально можно тратить на привлечение',
    'Монетизация привязана к разовой покупке, а не к повторяемости',
  ],
};

const CHECKLIST_TEMPLATES = [
  'Провести 10-15 интервью с потенциальными клиентами до вложения денег',
  'Собрать лендинг и проверить, готовы ли люди оставить предоплату или email',
  'Посчитать юнит-экономику на реальных, а не оптимистичных цифрах',
  'Найти и изучить 3-5 прямых конкурентов — их цены, отзывы, слабые места',
  'Сделать мини-версию идеи и протестировать на маленькой группе за 2-4 недели',
  'Проверить законодательные и лицензионные ограничения для этой сферы',
];

function economicsFor(rng: () => number): { label: string; value: string }[] {
  const avgCheck = pick(rng, [590, 890, 1290, 1990, 2490]);
  const monthlyClients = pick(rng, [40, 80, 150, 300]);
  const revenue = avgCheck * monthlyClients;
  const costRatio = 0.55 + rng() * 0.2;
  const costs = Math.round(revenue * costRatio);
  const margin = revenue - costs;
  const marginPct = Math.round((margin / revenue) * 100);
  const breakeven = Math.max(1, Math.round(costs / (avgCheck * 0.9)));

  return [
    { label: 'Средний чек', value: `${avgCheck.toLocaleString('ru-RU')} ₽` },
    { label: 'Клиентов в месяц (старт)', value: `${monthlyClients}` },
    { label: 'Выручка в месяц', value: `${revenue.toLocaleString('ru-RU')} ₽` },
    { label: 'Издержки в месяц', value: `${costs.toLocaleString('ru-RU')} ₽` },
    { label: 'Маржа', value: `${margin.toLocaleString('ru-RU')} ₽ (~${marginPct}%)` },
    { label: 'Точка безубыточности', value: `~${breakeven} клиентов/мес` },
  ];
}

const IMPROVEMENTS_BY_MODE: Record<Mode, string[]> = {
  praise: [
    'Запустите пилот на маленькой аудитории, чтобы собрать первые честные отзывы',
    'Сформулируйте одно чёткое обещание клиенту — то, что легко пересказать в одном предложении',
    'Найдите первых 10 клиентов лично, а не через рекламу — так дешевле и честнее',
    'Добавьте элемент, который заставит клиентов возвращаться, а не покупать один раз',
    'Упакуйте историю бренда — люди платят не только за продукт, но и за смысл',
  ],
  criticize: [
    'Сузьте аудиторию до одного конкретного сегмента и сделайте продукт идеальным для него',
    'Проверьте гипотезу спроса до вложений — лендинг, интервью, тестовые продажи',
    'Пересчитайте юнит-экономику на реальных, а не желаемых цифрах',
    'Найдите отличие от ближайшего конкурента, которое клиент заметит за 3 секунды',
    'Добавьте механику повторной покупки — иначе весь рост держится на новых клиентах',
  ],
  destroy: [
    'Проверьте, готов ли хоть один человек заплатить деньги прямо сейчас — до любых доработок',
    'Урежьте идею до самого дешёвого варианта, который можно протестировать за неделю',
    'Найдите нишу настолько узкую, что в ней вообще нет конкурентов',
    'Смените модель монетизации — возможно, сама идея неплохая, а вот заработок на ней выбран неверно',
    'Будьте готовы полностью отказаться от идеи, если тест спроса провалится — и это нормально',
  ],
  monetize: [
    'Добавьте подписочную модель — предсказуемый доход лучше разовых продаж',
    'Введите несколько тарифов — базовый заманивает, дорогой приносит основную прибыль',
    'Сделайте апсейл сразу после первой покупки, пока клиент ещё «тёплый»',
    'Проверьте B2B-версию идеи — корпоративные чеки обычно выше и стабильнее',
    'Добавьте партнёрскую программу — пусть клиенты приводят клиентов за вознаграждение',
  ],
};

function heuristicAnalysis(idea: string, mode: Mode): AnalysisResult {
  const rng = mulberry32(hashString(`${idea}::${mode}`));
  const [min, max] = SCORE_RANGE[mode];
  const score = Math.round(min + rng() * (max - min));

  return {
    verdict: verdictFor(idea, mode, score),
    score,
    scoreLabel: pick(rng, SCORE_LABELS[mode]),
    audience: audienceFor(idea, rng),
    risks: pickN(rng, RISKS_BY_MODE[mode], 4),
    competitors: pickN(rng, COMPETITOR_TEMPLATES, 4),
    weaknesses: pickN(rng, WEAKNESS_BY_MODE[mode], 3),
    checklist: pickN(rng, CHECKLIST_TEMPLATES, 4),
    economics: economicsFor(rng),
    improvements: pickN(rng, IMPROVEMENTS_BY_MODE[mode], 5),
  };
}

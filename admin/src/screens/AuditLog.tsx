import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Tabs } from '@/components/ui/Tabs';
import { useAuditStore } from '@/store/useAuditStore';
import { timeAgo } from '@/lib/format';
import { cn } from '@/lib/cn';

const TONE_FILTERS = [
  { id: 'all', label: 'Все' },
  { id: 'danger', label: 'Опасные' },
  { id: 'neutral', label: 'Обычные' },
];
const TONE_DOT: Record<string, string> = { accent: 'bg-accent', danger: 'bg-danger', neutral: 'bg-text-faint' };

export function AuditLog() {
  const entries = useAuditStore((s) => s.entries);
  const actors = useAuditStore((s) => s.actors);
  const load = useAuditStore((s) => s.load);
  const [query, setQuery] = useState('');
  const [actor, setActor] = useState('all');
  const [tone, setTone] = useState('all');

  // Фильтруем запросом к серверу, а не по загруженному куску: журнал
  // длинный, и искать в нём нужно как раз то, что уже ушло вниз. Поиск
  // отложен, чтобы не дёргать API на каждую букву.
  useEffect(() => {
    const t = setTimeout(() => load({ actor, tone, q: query }), query ? 350 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actor, tone, query]);

  return (
    <div className="pb-10">
      <PageHeader
        title="Аудит-лог"
        subtitle="Все действия команды, без удаления"
      />

      <div className="px-4 sm:px-8 pb-5 flex items-center gap-3 flex-wrap">
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск по действию или человеку" className="w-full sm:w-[280px]" />
        {/* Сотрудники берутся из самого журнала, а не из состава команды:
            человек мог уйти, а его действия остались и их надо уметь найти. */}
        <Select value={actor} onChange={(e) => setActor(e.target.value)} className="w-full sm:w-[200px]">
          <option value="all">Все сотрудники</option>
          {actors.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </Select>
        <Tabs value={tone} onChange={setTone} options={TONE_FILTERS} />
      </div>

      <div className="px-4 sm:px-8">
        <Card className="p-6">
          {entries.length === 0 ? (
            <p className="text-center text-[13px] text-text-faint py-8">Ничего не найдено</p>
          ) : (
            <div className="relative">
              <div className="absolute left-[5px] top-2 bottom-2 w-px bg-border-soft" />
              <div className="space-y-5">
                {entries.map((e) => (
                  <div key={e.id} className="relative flex gap-3.5 pl-0">
                    <span className={cn('h-[11px] w-[11px] rounded-full mt-1 shrink-0 ring-4 ring-surface', TONE_DOT[e.tone])} />
                    <div className="min-w-0 -mt-0.5">
                      <p className="text-[14px] text-text leading-snug">
                        <span className="font-semibold">{e.actorName}</span> {e.action}
                      </p>
                      <p className="text-[12px] text-text-faint mt-0.5">{timeAgo(e.minutesAgo)} · {e.actorRoleLabel}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

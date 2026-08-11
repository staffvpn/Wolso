import { useEffect, useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Tabs } from '@/components/ui/Tabs';
import { useAuditStore } from '@/store/useAuditStore';
import { timeAgo } from '@/lib/format';
import { cn } from '@/lib/cn';

const ROLE_FILTERS = ['Все', 'Owner', 'Админ', 'Модератор', 'Поддержка'];
const TONE_DOT: Record<string, string> = { accent: 'bg-accent', danger: 'bg-danger', neutral: 'bg-text-faint' };

export function AuditLog() {
  const entries = useAuditStore((s) => s.entries);
  const load = useAuditStore((s) => s.load);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('Все');

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      const matchesRole = roleFilter === 'Все' || e.actorRoleLabel === roleFilter;
      const matchesQuery = !query.trim() || `${e.actorName} ${e.action}`.toLowerCase().includes(query.trim().toLowerCase());
      return matchesRole && matchesQuery;
    });
  }, [entries, query, roleFilter]);

  return (
    <div className="pb-10">
      <PageHeader
        title="Аудит-лог"
        subtitle="Все действия команды, без удаления"
        right={
          <Button variant="outline">
            <Download size={15} /> Экспорт CSV
          </Button>
        }
      />

      <div className="px-8 pb-5 flex items-center gap-3 flex-wrap">
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск по действию или человеку" className="w-[280px]" />
        <Tabs value={roleFilter} onChange={setRoleFilter} options={ROLE_FILTERS.map((r) => ({ id: r, label: r }))} />
      </div>

      <div className="px-8">
        <Card className="p-6">
          {filtered.length === 0 ? (
            <p className="text-center text-[13px] text-text-faint py-8">Ничего не найдено</p>
          ) : (
            <div className="relative">
              <div className="absolute left-[5px] top-2 bottom-2 w-px bg-border-soft" />
              <div className="space-y-5">
                {filtered.map((e) => (
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

import { useEffect, useMemo, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { EmptyPanel } from '@/components/EmptyPanel';
import { useSupportStore } from '@/store/useSupportStore';
import { timeAgo } from '@/lib/format';
import { cn } from '@/lib/cn';

export function Support() {
  const threads = useSupportStore((s) => s.threads);
  const messagesByThread = useSupportStore((s) => s.messagesByThread);
  const loadThreads = useSupportStore((s) => s.loadThreads);
  const loadMessages = useSupportStore((s) => s.loadMessages);
  const reply = useSupportStore((s) => s.reply);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadThreads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedId && threads[0]) setSelectedId(threads[0].id);
  }, [threads, selectedId]);

  useEffect(() => {
    if (selectedId) loadMessages(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // Replies land here from a mobile-app user's own session, not this one —
  // poll the open thread so a new message shows up without a page refresh.
  useEffect(() => {
    if (!selectedId) return;
    const interval = setInterval(() => loadMessages(selectedId), 4000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const messages = useMemo(() => (selectedId ? messagesByThread[selectedId] ?? [] : []), [messagesByThread, selectedId]);
  const selected = threads.find((t) => t.id === selectedId) ?? null;

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  function send() {
    if (!text.trim() || !selectedId) return;
    reply(selectedId, text.trim());
    setText('');
  }

  return (
    <div className="pb-10 flex flex-col lg:h-full lg:min-h-0">
      <PageHeader title="Поддержка" subtitle="Переписка с работниками и работодателями" />

      <div className="lg:flex-1 lg:min-h-0 px-4 sm:px-8 pb-6 lg:pb-0 grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-5">
        <Card className="lg:overflow-hidden flex flex-col">
          <div className="lg:overflow-y-auto divide-y divide-border-soft">
            {threads.length === 0 && <p className="px-5 py-8 text-center text-[13px] text-text-faint">Обращений пока нет</p>}
            {threads.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedId(t.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-surface-2 transition-colors',
                  selectedId === t.id && 'bg-surface-2',
                )}
              >
                <Avatar name={t.contactName} size={38} square={t.kind === 'employer'} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-[14px] truncate">{t.contactName}</p>
                    {t.lastMessageMinAgo !== undefined && (
                      <span className="text-[11px] text-text-faint shrink-0">{timeAgo(t.lastMessageMinAgo)}</span>
                    )}
                  </div>
                  <p className="text-[12px] text-text-faint truncate">{t.lastMessagePreview ?? 'Нет сообщений'}</p>
                </div>
                {t.unread > 0 && (
                  <span className="h-5 min-w-5 px-1.5 rounded-full bg-accent text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                    {t.unread}
                  </span>
                )}
              </button>
            ))}
          </div>
        </Card>

        <Card className="p-0 overflow-hidden flex flex-col lg:h-full">
          {!selected ? (
            <div className="p-6">
              <EmptyPanel title="Выберите обращение" description="Нажмите на строку слева, чтобы открыть переписку." />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border-soft shrink-0">
                <Avatar name={selected.contactName} size={36} square={selected.kind === 'employer'} />
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-[14px] truncate">{selected.contactName}</p>
                </div>
                <Badge tone="neutral">{selected.kind === 'worker' ? 'Соискатель' : 'Работодатель'}</Badge>
              </div>

              <div className="flex-1 min-h-[320px] lg:min-h-0 overflow-y-auto px-5 py-4 space-y-3">
                {messages.map((m) => (
                  <div key={m.id} className={cn('flex', m.from === 'staff' ? 'justify-end' : 'justify-start')}>
                    <div
                      className={cn(
                        'max-w-[75%] rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed',
                        m.from === 'staff' ? 'bg-accent text-white rounded-br-md' : 'bg-surface-2 text-text rounded-bl-md',
                      )}
                    >
                      {m.text}
                    </div>
                  </div>
                ))}
                <div ref={endRef} />
              </div>

              <div className="flex items-center gap-2 px-5 py-3.5 border-t border-border-soft shrink-0">
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && send()}
                  placeholder="Ответить…"
                  className="flex-1 h-10 rounded-xl bg-surface-2 border border-border px-3.5 text-[14px] outline-none focus:border-accent placeholder:text-text-faint"
                />
                <button
                  onClick={send}
                  className="h-10 w-10 rounded-xl bg-accent text-white flex items-center justify-center shrink-0"
                  aria-label="Отправить"
                >
                  <Send size={16} />
                </button>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

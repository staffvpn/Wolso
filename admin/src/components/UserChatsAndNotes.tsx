import { useEffect, useState } from 'react';
import { MessageSquare, ChevronLeft, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Input';
import { useCan } from '@/store/useSessionStore';
import { cn } from '@/lib/cn';
import {
  fetchUserChats,
  fetchChatMessages,
  fetchUserNotes,
  addUserNote,
  deleteUserNote,
  type UserChat,
  type ChatMessageRow,
  type UserNote,
} from '@/services/usersApi';
import { formatDayMonth } from '@/lib/format';

function chatTime(createdAt: string): string {
  const d = new Date(createdAt.includes('T') ? createdAt : `${createdAt.replace(' ', 'T')}Z`);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

/** Переписка сторон и заметки команды — в карточке пользователя, а не
 *  отдельным экраном: разбираться в споре начинают, глядя на человека, и
 *  ходить за перепиской в другое место означало бы терять контекст. */
export function UserChatsAndNotes({ kind, id }: { kind: 'seeker' | 'employer'; id: string }) {
  return (
    <>
      <ChatsBlock kind={kind} id={id} />
      <NotesBlock kind={kind} id={id} />
    </>
  );
}

function ChatsBlock({ kind, id }: { kind: 'seeker' | 'employer'; id: string }) {
  const canView = useCan('viewSupportChats');
  const [chats, setChats] = useState<UserChat[]>([]);
  const [openChat, setOpenChat] = useState<UserChat | null>(null);
  const [messages, setMessages] = useState<ChatMessageRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setOpenChat(null);
    setMessages([]);
    setError(null);
    if (!canView) return;
    fetchUserChats(kind, id)
      .then(setChats)
      .catch(() => setChats([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, id, canView]);

  async function open(chat: UserChat) {
    setError(null);
    try {
      setMessages(await fetchChatMessages(chat.id));
      setOpenChat(chat);
    } catch {
      setError('Не получилось открыть переписку.');
    }
  }

  if (!canView) return null;

  return (
    <div>
      <p className="text-[12px] font-semibold uppercase tracking-wide text-text-faint mb-2">
        Переписка{chats.length > 0 ? ` (${chats.length})` : ''}
      </p>

      {openChat ? (
        <div>
          <button
            onClick={() => setOpenChat(null)}
            className="inline-flex items-center gap-1 text-[13px] font-semibold text-text-muted mb-2 hover:text-text"
          >
            <ChevronLeft size={14} /> Все чаты
          </button>
          <p className="text-[13px] text-text-faint mb-2">
            {openChat.workerName} ↔ {openChat.companyName}
            {openChat.positionLabel ? ` · «${openChat.positionLabel}»` : ''}
          </p>
          <div className="rounded-xl bg-surface-2 p-3 max-h-[320px] overflow-y-auto flex flex-col gap-1.5">
            {messages.length === 0 && <p className="text-[13px] text-text-faint">Сообщений нет</p>}
            {messages.map((m) =>
              m.sender === 'system' ? (
                <div key={m.id} className="self-center text-[11.5px] text-text-faint text-center px-3 py-1">
                  {m.text}
                </div>
              ) : (
                <div
                  key={m.id}
                  className={cn(
                    'max-w-[82%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed',
                    m.sender === 'worker'
                      ? 'self-start bg-surface text-text rounded-bl-md border border-border-soft'
                      : 'self-end bg-accent text-accent-fg rounded-br-md',
                  )}
                >
                  <span className="whitespace-pre-line break-words">{m.kind === 'image' ? '📷 Фото' : m.text}</span>
                  <span className={cn('block text-[10px] mt-0.5 font-mono', m.sender === 'worker' ? 'text-text-faint' : 'text-accent-fg/70')}>
                    {chatTime(m.createdAt)}
                  </span>
                </div>
              ),
            )}
          </div>
          <p className="text-[11px] text-text-faint mt-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-surface border border-border-soft align-middle mr-1" /> {openChat.workerName}
            <span className="inline-block h-2 w-2 rounded-full bg-accent align-middle mx-1 ml-3" /> {openChat.companyName}
          </p>
          {/* Только чтение: писать в чужой чат от лица одной из сторон —
              совсем другое дело, чем в нём разобраться. */}
          <p className="text-[12px] text-text-faint mt-2">Только просмотр. Открытие записано в аудит-лог.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {chats.length === 0 && <p className="text-[13px] text-text-faint">Переписок нет</p>}
          {chats.map((c) => (
            <button
              key={c.id}
              onClick={() => open(c)}
              className="rounded-lg bg-surface-2 px-3 py-2 text-left hover:bg-surface-hover transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-semibold text-text truncate">
                  {kind === 'seeker' ? c.companyName : c.workerName}
                </span>
                <Badge tone="neutral">
                  <MessageSquare size={11} /> {c.messageCount}
                </Badge>
              </div>
              <p className="text-[12px] text-text-faint mt-0.5">
                {c.positionLabel ?? 'Смена удалена'}
                {c.date ? ` · ${formatDayMonth(new Date(c.date))}` : ''}
              </p>
            </button>
          ))}
        </div>
      )}

      {error && <p className="text-[12px] text-danger mt-2">{error}</p>}
    </div>
  );
}

function NotesBlock({ kind, id }: { kind: 'seeker' | 'employer'; id: string }) {
  const canWrite = useCan('blockUsers');
  const [notes, setNotes] = useState<UserNote[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    try {
      setNotes(await fetchUserNotes(kind, id));
    } catch {
      setNotes([]);
    }
  }

  useEffect(() => {
    setText('');
    setError(null);
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, id]);

  async function add() {
    if (!text.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await addUserNote(kind, id, text.trim());
      setText('');
      await reload();
    } catch {
      setError('Не получилось сохранить заметку. Возможно, не применена миграция 0031.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="text-[12px] font-semibold uppercase tracking-wide text-text-faint mb-2">
        Заметки команды{notes.length > 0 ? ` (${notes.length})` : ''}
      </p>

      <div className="flex flex-col gap-2 mb-3">
        {notes.length === 0 && <p className="text-[13px] text-text-faint">Пока пусто</p>}
        {notes.map((n) => (
          <div key={n.id} className="rounded-lg bg-surface-2 px-3 py-2">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[13px] text-text leading-relaxed whitespace-pre-line min-w-0">{n.text}</p>
              {canWrite && (
                <button
                  onClick={async () => {
                    await deleteUserNote(n.id);
                    await reload();
                  }}
                  aria-label="Удалить заметку"
                  className="text-text-faint hover:text-danger shrink-0"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
            <p className="text-[12px] text-text-faint mt-1">
              {n.authorName} · {formatDayMonth(new Date(n.createdAt))}
            </p>
          </div>
        ))}
      </div>

      {canWrite && (
        <>
          <Textarea
            rows={2}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Например: звонил, обещал заменить фото"
          />
          {error && <p className="text-[12px] text-danger mt-1.5 leading-relaxed">{error}</p>}
          <Button variant="outline" className="w-full mt-2" disabled={!text.trim() || busy} onClick={add}>
            {busy ? 'Сохраняем…' : 'Добавить заметку'}
          </Button>
        </>
      )}
    </div>
  );
}

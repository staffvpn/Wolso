import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Send, ChevronLeft, RotateCw, Flag } from 'lucide-react';
import { motion } from 'framer-motion';
import { IconButton } from '@/components/ui/IconButton';
import { Button } from '@/components/ui/Button';
import { Avatar, LogoBadge } from '@/components/ui/Avatar';
import { ReportSheet } from '@/components/ReportSheet';
import { useChatStore } from '@/store/useChatStore';
import { useRole } from '@/hooks/useRole';
import { QUICK_REPLIES } from '@/data/chats';
import { cn } from '@/lib/cn';
import type { ChatMessage } from '@/types';

// `?? []` directly inside a Zustand selector allocates a brand-new array
// every single time the store re-evaluates it — since nothing ever equals
// a freshly allocated array by reference, useSyncExternalStore sees a
// "changed" snapshot on every check and re-renders forever (React throws
// "Maximum update depth exceeded" once its loop guard trips). One stable
// reference for the empty case avoids that entirely.
const EMPTY_MESSAGES: ChatMessage[] = [];

export function ChatDetail() {
  const navigate = useNavigate();
  const role = useRole();
  const actor = role === 'worker' ? 'worker' : 'company';
  const { chatId } = useParams<{ chatId: string }>();
  const chatsLoaded = useChatStore((s) => s.loaded);
  const chatsError = useChatStore((s) => s.error);
  const loadChats = useChatStore((s) => s.load);
  const chat = useChatStore((s) => s.chats.find((c) => c.id === chatId));
  const messages = useChatStore((s) => (chatId ? s.messagesByChat[chatId] : undefined) ?? EMPTY_MESSAGES);
  const loadMessages = useChatStore((s) => s.loadMessages);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const markRead = useChatStore((s) => s.markRead);

  const [text, setText] = useState('');
  const [reportOpen, setReportOpen] = useState(false);
  const [messagesError, setMessagesError] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  function reloadMessages() {
    if (!chatId) return;
    setMessagesError(false);
    loadMessages(chatId, actor).catch(() => setMessagesError(true));
  }

  // Navigating here directly (deep link, reopening the app on this exact
  // route) can beat ChatList's own load — chats would still be empty, and
  // bouncing straight back below would fire immediately, before the store
  // ever got a chance to actually find this chat. Load it here too if
  // nobody has yet.
  useEffect(() => {
    if (!chatsLoaded) loadChats(actor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (chatId) {
      setMessagesError(false);
      loadMessages(chatId, actor).catch(() => setMessagesError(true));
      markRead(chatId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  // Navigating away belongs in an effect, not the render body: calling
  // navigate(-1) directly while rendering used to bounce back to a chat
  // that's genuinely gone (deleted when its shift closed, a stale link, a
  // deep link with no browser history behind it) — history.back() with
  // nothing to go back to doesn't change the route, so the same render
  // fired again, calling navigate(-1) again, forever, until React's
  // re-render guard tripped and took down the whole app. A fixed
  // destination (the chat list) can't loop like that.
  useEffect(() => {
    if (chatsLoaded && !chatsError && !chat) {
      navigate(role === 'worker' ? '/w/chats' : '/e/chats', { replace: true });
    }
  }, [chatsLoaded, chatsError, chat, navigate, role]);

  if (!chatsLoaded) return null;
  if (!chat && chatsError) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-8 gap-4 text-center safe-top safe-bottom">
        <p className="text-[15px] font-semibold">Не удалось загрузить чат</p>
        <p className="text-[13px] text-text-muted">Проверьте соединение и попробуйте ещё раз.</p>
        <Button onClick={() => loadChats(actor)}>
          <RotateCw size={16} /> Повторить
        </Button>
      </div>
    );
  }
  if (!chat) return null;

  // На кого жалуемся: соискатель — на заведение, работодатель — на
  // соискателя, то есть всегда на другую сторону этого чата.
  const reportTargetId = actor === 'company' ? chat.workerId : chat.companyId;

  function handleSend(value: string) {
    if (!value.trim() || !chatId) return;
    sendMessage(chatId, value.trim(), actor);
    setText('');
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-3 px-5 pt-4 pb-3 safe-top shrink-0 border-b border-border-soft">
        <IconButton onClick={() => navigate(-1)} aria-label="Назад">
          <ChevronLeft size={20} />
        </IconButton>
        {chat.avatarUrl ? (
          <Avatar src={chat.avatarUrl} name={chat.contactName} size={38} />
        ) : chat.logoInitial ? (
          <LogoBadge initial={chat.logoInitial} color={chat.logoColor ?? '#6b6d76'} size={38} />
        ) : (
          <Avatar name={chat.contactName} size={38} />
        )}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-[15px] truncate">{chat.contactName}</p>
        </div>
        {chat.shiftId && (
          <span className="text-[12px] font-semibold text-text-muted bg-surface-2 rounded-full px-3 py-1.5 shrink-0">Смена</span>
        )}
        {/* Жаловаться разумнее всего отсюда: в чате видно, на что именно.
            Кнопка есть у обеих сторон — жалоба нужна и на соискателя, и на
            заведение. */}
        {reportTargetId && (
          <IconButton size={36} onClick={() => setReportOpen(true)} aria-label="Пожаловаться">
            <Flag size={16} className="text-text-muted" />
          </IconButton>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-3">
        {messagesError && (
          <div className="rounded-2xl bg-danger/10 border border-danger/30 px-4 py-3 flex items-center justify-between gap-3">
            <p className="text-[13px] text-danger">Не удалось загрузить сообщения</p>
            <button onClick={reloadMessages} className="text-[13px] font-semibold text-danger shrink-0 flex items-center gap-1">
              <RotateCw size={13} /> Повторить
            </button>
          </div>
        )}
        {messages.map((m) => {
          if (m.kind === 'system') {
            return (
              <div key={m.id} className="rounded-2xl bg-accent-soft text-accent px-4 py-3 text-[13px] leading-relaxed whitespace-pre-line font-medium">
                {m.text}
              </div>
            );
          }
          if (m.kind === 'location') {
            return (
              <div key={m.id} className="rounded-2xl bg-surface border border-border-soft px-4 py-3">
                <p className="text-[13px] whitespace-pre-line leading-relaxed">{m.text}</p>
              </div>
            );
          }
          return (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn('flex', m.from === 'me' ? 'justify-end' : 'justify-start')}
            >
              <div
                className={cn(
                  'max-w-[78%] rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed whitespace-pre-line break-words',
                  m.from === 'me' ? 'bg-accent text-accent-fg rounded-br-md' : 'bg-surface-2 text-text rounded-bl-md',
                )}
              >
                {m.text}
              </div>
            </motion.div>
          );
        })}
        <div ref={endRef} />
      </div>

      {role === 'worker' && (
        <div className="flex gap-2 px-5 pb-2 shrink-0 overflow-x-auto">
          {QUICK_REPLIES.map((r) => (
            <button
              key={r}
              onClick={() => handleSend(r)}
              className="shrink-0 h-9 px-3.5 rounded-full border border-border text-[13px] font-medium text-text-muted"
            >
              {r}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 px-5 pb-5 pt-2 shrink-0 safe-bottom">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend(text)}
          placeholder="Сообщение…"
          className="flex-1 h-11 rounded-2xl bg-surface border border-border px-4 text-[14px] outline-none focus:border-accent placeholder:text-text-faint"
        />
        <button
          onClick={() => handleSend(text)}
          className="h-11 w-11 rounded-2xl bg-accent text-accent-fg flex items-center justify-center shrink-0"
          aria-label="Отправить"
        >
          <Send size={17} />
        </button>
      </div>

      {reportTargetId && (
        <ReportSheet
          open={reportOpen}
          onClose={() => setReportOpen(false)}
          targetKind={actor === 'company' ? 'worker' : 'company'}
          targetId={reportTargetId}
          targetName={chat.contactName}
          as={actor === 'company' ? 'company' : 'worker'}
        />
      )}
    </div>
  );
}

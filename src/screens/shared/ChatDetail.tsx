import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Send, ChevronLeft, RotateCw } from 'lucide-react';
import { motion } from 'framer-motion';
import { IconButton } from '@/components/ui/IconButton';
import { Button } from '@/components/ui/Button';
import { Avatar, LogoBadge } from '@/components/ui/Avatar';
import { useChatStore } from '@/store/useChatStore';
import { useRole } from '@/hooks/useRole';
import { QUICK_REPLIES } from '@/data/chats';
import { cn } from '@/lib/cn';

export function ChatDetail() {
  const navigate = useNavigate();
  const role = useRole();
  const actor = role === 'worker' ? 'worker' : 'company';
  const { chatId } = useParams<{ chatId: string }>();
  const chatsLoaded = useChatStore((s) => s.loaded);
  const chatsError = useChatStore((s) => s.error);
  const loadChats = useChatStore((s) => s.load);
  const chat = useChatStore((s) => s.chats.find((c) => c.id === chatId));
  const messages = useChatStore((s) => s.messagesByChat[chatId ?? ''] ?? []);
  const loadMessages = useChatStore((s) => s.loadMessages);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const markRead = useChatStore((s) => s.markRead);

  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

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
      loadMessages(chatId, actor);
      markRead(chatId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

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
  if (!chat) {
    navigate(-1);
    return null;
  }

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
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-3">
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
                  'max-w-[78%] rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed',
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
    </div>
  );
}

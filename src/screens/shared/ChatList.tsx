import { useEffect } from 'react';
import { usePoll } from '@/lib/usePoll';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { TopBar } from '@/components/ui/TopBar';
import { Avatar, LogoBadge } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { useChatStore } from '@/store/useChatStore';
import { useRole } from '@/hooks/useRole';

export function ChatList() {
  const navigate = useNavigate();
  const role = useRole();
  const chats = useChatStore((s) => s.chats);
  const loading = useChatStore((s) => s.loading);
  const load = useChatStore((s) => s.load);
  const refresh = useChatStore((s) => s.refresh);

  useEffect(() => {
    load(role === 'worker' ? 'worker' : 'company');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  // Реже, чем сама переписка: здесь важны только счётчик непрочитанных и
  // последняя строка, а не каждое сообщение. Обновление тихое — список
  // уже на экране и мигать спиннером из-за фонового запроса не должен.
  usePoll(() => refresh(role === 'worker' ? 'worker' : 'company'), 5000);

  return (
    <div className="flex flex-col h-full min-h-0">
      <TopBar title="Чаты" />

      <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-4">
        {!loading && chats.length === 0 ? (
          <EmptyState title="Пока нет чатов" description="Чат появится, как только смена будет подтверждена." />
        ) : (
          <div className="divide-y divide-border-soft">
            {chats.map((chat, i) => (
              <motion.button
                key={chat.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i, 6) * 0.03 }}
                onClick={() => navigate(`/${role === 'worker' ? 'w' : 'e'}/chats/${chat.id}`)}
                className="w-full flex items-center gap-3 py-3.5 text-left"
              >
                <div className="relative shrink-0">
                  {chat.avatarUrl ? (
                    <Avatar src={chat.avatarUrl} name={chat.contactName} size={46} />
                  ) : chat.logoInitial ? (
                    <LogoBadge initial={chat.logoInitial} color={chat.logoColor ?? '#6b6d76'} size={46} />
                  ) : (
                    <Avatar name={chat.contactName} size={46} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[15px] truncate">{chat.contactName}</p>
                  <p className="text-[13px] text-text-muted truncate">{chat.lastMessagePreview ?? 'Нет сообщений'}</p>
                </div>
                {chat.unread > 0 && (
                  <span className="h-5 min-w-5 px-1.5 rounded-full bg-accent text-accent-fg text-[11px] font-bold flex items-center justify-center shrink-0">
                    {chat.unread}
                  </span>
                )}
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { TopBar } from '@/components/ui/TopBar';
import { Avatar, LogoBadge } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { useChatStore } from '@/store/useChatStore';
import { useRole } from '@/hooks/useRole';
import { getCompany, COMPANIES } from '@/data/companies';

export function ChatList() {
  const navigate = useNavigate();
  const role = useRole();
  const chats = useChatStore((s) => s.chats);
  const messagesByChat = useChatStore((s) => s.messagesByChat);

  const isKnownCompany = (id: string) => COMPANIES.some((c) => c.id === id);

  return (
    <div className="flex flex-col h-full min-h-0">
      <TopBar title="Чаты" />

      <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-4">
        {chats.length === 0 ? (
          <EmptyState title="Пока нет чатов" description="Чат появится, как только смена будет подтверждена." />
        ) : (
          <div className="divide-y divide-border-soft">
            {chats.map((chat, i) => {
              const messages = messagesByChat[chat.id] ?? [];
              const last = messages[messages.length - 1];
              const company = isKnownCompany(chat.companyId) ? getCompany(chat.companyId) : undefined;

              return (
                <motion.button
                  key={chat.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i, 6) * 0.03 }}
                  onClick={() => navigate(`/${role === 'worker' ? 'w' : 'e'}/chats/${chat.id}`)}
                  className="w-full flex items-center gap-3 py-3.5 text-left"
                >
                  <div className="relative shrink-0">
                    {company ? (
                      <LogoBadge initial={company.logoInitial} color={company.logoColor} size={46} />
                    ) : (
                      <Avatar name={chat.contactName} size={46} />
                    )}
                    {chat.online && (
                      <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-accent border-2 border-bg" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[15px] truncate">{chat.contactName}</p>
                    <p className="text-[13px] text-text-muted truncate">
                      {last ? last.text.split('\n')[0] : 'Нет сообщений'}
                    </p>
                  </div>
                  {chat.unread > 0 && (
                    <span className="h-5 min-w-5 px-1.5 rounded-full bg-accent text-accent-fg text-[11px] font-bold flex items-center justify-center shrink-0">
                      {chat.unread}
                    </span>
                  )}
                </motion.button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, ChevronLeft, LifeBuoy } from 'lucide-react';
import { motion } from 'framer-motion';
import { IconButton } from '@/components/ui/IconButton';
import { useSupportStore } from '@/store/useSupportStore';
import { useRole } from '@/hooks/useRole';
import { cn } from '@/lib/cn';

/** Wolso ↔ user support chat — separate from the worker-employer chat.
 *  Staff read and reply from the admin dashboard's Support section. */
export function Support() {
  const navigate = useNavigate();
  const role = useRole();
  const actor = role === 'worker' ? 'worker' : 'company';
  const messages = useSupportStore((s) => s.messages);
  const loading = useSupportStore((s) => s.loading);
  const load = useSupportStore((s) => s.load);
  const sendMessage = useSupportStore((s) => s.sendMessage);

  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    load(actor);
    // Support replies come from a staff member on the admin dashboard, not
    // from this session, so there's no push channel to tell the app a new
    // one arrived — poll while the screen is open instead of making people
    // pull-to-refresh to see a reply.
    const interval = setInterval(() => load(actor, true), 4000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  function handleSend() {
    if (!text.trim()) return;
    sendMessage(text.trim(), actor);
    setText('');
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-3 px-5 pt-4 pb-3 safe-top shrink-0 border-b border-border-soft">
        <IconButton onClick={() => navigate(-1)} aria-label="Назад">
          <ChevronLeft size={20} />
        </IconButton>
        <div className="h-9 w-9 rounded-full bg-accent-soft flex items-center justify-center shrink-0">
          <LifeBuoy size={16} className="text-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-[15px] truncate">Поддержка Wolso</p>
          <p className="text-[12px] text-text-muted">Обычно отвечаем в течение дня</p>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-3">
        {!loading && messages.length === 0 && (
          <p className="text-center text-[13px] text-text-faint pt-8">Напишите нам, если что-то не работает или остались вопросы</p>
        )}
        {messages.map((m) => (
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
        ))}
        <div ref={endRef} />
      </div>

      <div className="flex items-center gap-2 px-5 pb-5 pt-2 shrink-0 safe-bottom">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Сообщение…"
          className="flex-1 h-11 rounded-2xl bg-surface border border-border px-4 text-[14px] outline-none focus:border-accent placeholder:text-text-faint"
        />
        <button
          onClick={handleSend}
          className="h-11 w-11 rounded-2xl bg-accent text-accent-fg flex items-center justify-center shrink-0"
          aria-label="Отправить"
        >
          <Send size={17} />
        </button>
      </div>
    </div>
  );
}

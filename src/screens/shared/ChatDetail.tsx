import { useEffect, useRef, useState } from 'react';
import { usePoll } from '@/lib/usePoll';
import { useNavigate, useParams } from 'react-router-dom';
import { Send, ChevronLeft, RotateCw, Flag, Paperclip, Zap, Check, CheckCheck, ShieldAlert } from 'lucide-react';
import { motion } from 'framer-motion';
import { IconButton } from '@/components/ui/IconButton';
import { Button } from '@/components/ui/Button';
import { Avatar, LogoBadge } from '@/components/ui/Avatar';
import { SafeImage } from '@/components/ui/SafeImage';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Chip } from '@/components/ui/Chip';
import { ReportSheet } from '@/components/ReportSheet';
import { useChatStore } from '@/store/useChatStore';
import { useRole } from '@/hooks/useRole';
import { QUICK_REPLIES, EMPLOYER_QUICK_REPLIES } from '@/data/chats';
import { VISUALLY_HIDDEN_FILE_INPUT } from '@/lib/visuallyHidden';
import { compressImageFile, UnsupportedImageError } from '@/lib/imageCompress';
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
  const imageBlobs = useChatStore((s) => s.imageBlobs);
  const loadMessages = useChatStore((s) => s.loadMessages);
  const syncMessages = useChatStore((s) => s.syncMessages);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const sendImage = useChatStore((s) => s.sendImage);
  const loadImage = useChatStore((s) => s.loadImage);
  const markRead = useChatStore((s) => s.markRead);

  const [text, setText] = useState('');
  const [reportOpen, setReportOpen] = useState(false);
  const [quickRepliesOpen, setQuickRepliesOpen] = useState(false);
  const [messagesError, setMessagesError] = useState(false);
  const [sendError, setSendError] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Переписка обновлялась только при входе в чат: ответ собеседника
  // появлялся на экране, лишь когда человек выходил и заходил снова.
  // Теперь открытый чат сам догружает новое — при свёрнутом приложении
  // опрос останавливается, см. usePoll.
  usePoll(() => (chatId ? syncMessages(chatId, actor) : undefined), 2000, !!chatId);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  // Вложения подгружаются по одному авторизованному запросу на сообщение,
  // лениво — как только карточка с ним появилась на экране, а не все
  // разом при каждом опросе переписки.
  useEffect(() => {
    if (!chatId) return;
    for (const m of messages) {
      if (m.kind === 'image' && m.hasImage && !m.id.startsWith('local-') && !imageBlobs[m.id]) {
        loadImage(chatId, m.id, actor).catch(() => {});
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, messages]);

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
    const body = value.trim();
    if (!body || !chatId) return;
    setSendError(false);
    setText('');
    // Не отправившееся сообщение возвращается в поле ввода, а не пропадает
    // вместе с набранным текстом: переписываешь его тогда заново.
    sendMessage(chatId, body, actor).catch(() => {
      setSendError(true);
      setText((current) => (current ? current : body));
    });
  }

  async function handleImageChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !chatId) return;
    setImageError(null);
    try {
      await sendImage(chatId, await compressImageFile(file), actor);
    } catch (err) {
      setImageError(err instanceof UnsupportedImageError ? err.message : 'Фото не отправилось — проверьте связь и попробуйте ещё раз.');
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-3 px-5 pt-4 pb-3 safe-top shrink-0 border-b border-border-soft">
        <IconButton onClick={() => navigate(-1)} aria-label="Назад">
          <ChevronLeft size={20} />
        </IconButton>
        <div className="relative shrink-0">
          {chat.avatarUrl ? (
            <Avatar src={chat.avatarUrl} name={chat.contactName} size={38} />
          ) : chat.logoInitial ? (
            <LogoBadge initial={chat.logoInitial} color={chat.logoColor ?? '#6b6d76'} size={38} />
          ) : (
            <Avatar name={chat.contactName} size={38} />
          )}
          {chat.online && (
            <span className="absolute right-[-1px] bottom-[-1px] h-2.5 w-2.5 rounded-full bg-accent ring-2 ring-bg" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-[15px] truncate">{chat.contactName}</p>
          {chat.online && <p className="text-[11px] font-semibold text-accent -mt-0.5">в сети</p>}
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

      {/* Постоянное напоминание, а не разовое системное сообщение: его не
          должно уносить вверх вместе с историей переписки (экран всегда
          проматывает к последнему сообщению — см. endRef ниже), и видеть
          его должны обе стороны при каждом открытии чата, а не один раз. */}
      <div className="flex items-start gap-2 px-5 py-2.5 shrink-0 bg-warning-soft border-b border-border-soft">
        <ShieldAlert size={14} className="text-warning shrink-0 mt-0.5" />
        <p className="text-[11.5px] leading-snug text-text-muted">
          Договорённости и переписка за пределами Wolso — на ваш риск, мы их не контролируем и ответственности за них не несём.
        </p>
      </div>

      <div
        className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-3 bg-bg"
        style={{ backgroundImage: 'url(/chat-bg.png)', backgroundSize: 'cover', backgroundPosition: 'center' }}
      >
        {messagesError && (
          <div className="rounded-2xl bg-danger/10 border border-danger/30 px-4 py-3 flex items-center justify-between gap-3">
            <p className="text-[13px] text-danger">Не удалось загрузить сообщения</p>
            <button onClick={reloadMessages} className="text-[13px] font-semibold text-danger shrink-0 flex items-center gap-1">
              <RotateCw size={13} /> Повторить
            </button>
          </div>
        )}
        {/* Сообщение, которое не ушло. Текст уже вернулся в поле ввода —
            остаётся сказать, почему он там снова оказался. */}
        {sendError && (
          <p className="text-[12px] text-danger text-center">Сообщение не отправилось — проверьте связь и попробуйте ещё раз.</p>
        )}
        {imageError && <p className="text-[12px] text-danger text-center">{imageError}</p>}
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

          if (m.kind === 'image') {
            const url = imageBlobs[m.id];
            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn('flex flex-col gap-1', m.from === 'me' ? 'items-end' : 'items-start')}
              >
                <div
                  className={cn(
                    'max-w-[72%] w-56 rounded-2xl overflow-hidden',
                    m.from === 'me' ? 'rounded-br-md bg-accent p-1' : 'rounded-bl-md bg-surface-2 p-1',
                  )}
                >
                  {url ? (
                    <SafeImage src={url} alt="Фото" className="w-full h-auto rounded-xl block" />
                  ) : (
                    <div className="w-full aspect-[4/3] rounded-xl bg-surface animate-pulse" />
                  )}
                </div>
                {m.from === 'me' && <ReadReceipt read={!!m.read} />}
              </motion.div>
            );
          }

          return (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn('flex flex-col gap-1', m.from === 'me' ? 'items-end' : 'items-start')}
            >
              <div
                className={cn(
                  'max-w-[78%] rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed whitespace-pre-line break-words',
                  m.from === 'me' ? 'bg-accent text-accent-fg rounded-br-md' : 'bg-surface-2 text-text rounded-bl-md',
                )}
              >
                {m.text}
              </div>
              {m.from === 'me' && <ReadReceipt read={!!m.read} />}
            </motion.div>
          );
        })}
        <div ref={endRef} />
      </div>

      <div className="flex items-center gap-2 px-5 pb-5 pt-2 shrink-0 safe-bottom">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={VISUALLY_HIDDEN_FILE_INPUT}
          onChange={handleImageChosen}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="h-11 w-11 rounded-2xl bg-surface border border-border text-text-muted flex items-center justify-center shrink-0"
          aria-label="Прикрепить фото"
        >
          <Paperclip size={17} />
        </button>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend(text)}
          placeholder="Сообщение…"
          className="flex-1 min-w-0 h-11 rounded-2xl bg-surface border border-border px-4 text-[14px] outline-none focus:border-accent placeholder:text-text-faint"
        />
        <button
          onClick={() => setQuickRepliesOpen(true)}
          className="h-11 w-11 rounded-2xl bg-surface border border-border text-text-muted flex items-center justify-center shrink-0"
          aria-label="Готовые ответы"
        >
          <Zap size={17} />
        </button>
        <button
          onClick={() => handleSend(text)}
          className="h-11 w-11 rounded-2xl bg-accent text-accent-fg flex items-center justify-center shrink-0"
          aria-label="Отправить"
        >
          <Send size={17} />
        </button>
      </div>

      <BottomSheet open={quickRepliesOpen} onClose={() => setQuickRepliesOpen(false)}>
        <p className="font-bold text-[16px] mb-4">Готовые ответы</p>
        <div className="flex flex-wrap gap-2 pb-2">
          {(role === 'worker' ? QUICK_REPLIES : EMPLOYER_QUICK_REPLIES).map((r) => (
            <Chip
              key={r}
              onClick={() => {
                setQuickRepliesOpen(false);
                handleSend(r);
              }}
            >
              {r}
            </Chip>
          ))}
        </div>
      </BottomSheet>

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

/** Доставлено / прочитано — под своими сообщениями, тем же приёмом, что и
 *  в мессенджерах: одна галочка значит «дошло», две — что собеседник уже
 *  открыл чат после этого. */
function ReadReceipt({ read }: { read: boolean }) {
  return (
    <span className={cn('flex items-center gap-0.5 pr-1 text-[10px]', read ? 'text-accent' : 'text-text-faint')}>
      {read ? <CheckCheck size={12} /> : <Check size={12} />}
    </span>
  );
}

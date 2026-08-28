import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Check, Mail, Pencil, X, XCircle } from 'lucide-react';
import { TopBar } from '@/components/ui/TopBar';
import { Chip } from '@/components/ui/Chip';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { CandidateDetailOverlay } from '@/components/deck/CandidateDetailOverlay';
import { CloseShiftSheet } from '@/components/CloseShiftSheet';
import { CancelSheet } from '@/components/CancelSheet';
import { useEmployerStore } from '@/store/useEmployerStore';
import { useChatStore } from '@/store/useChatStore';
import { formatDateRange, formatRating, localDateStr, timeAgoSince } from '@/lib/format';
import type { Candidate } from '@/types';

const STATUS_LABEL: Record<string, string> = {
  active: 'Активна',
  pending_review: 'На модерации',
  rejected: 'Отклонена',
  closed: 'Завершена',
};
const STATUS_TONE: Record<string, 'accent' | 'neutral' | 'danger'> = {
  active: 'accent',
  pending_review: 'neutral',
  rejected: 'danger',
  closed: 'neutral',
};

export function VacancyDetail() {
  const navigate = useNavigate();
  const { vacancyId } = useParams<{ vacancyId: string }>();
  const vacancy = useEmployerStore((s) => s.vacancies.find((v) => v.id === vacancyId));
  const vacanciesLoaded = useEmployerStore((s) => s.vacancies.length > 0);
  const allCandidates = useEmployerStore((s) => s.candidates);
  const decideCandidate = useEmployerStore((s) => s.decideCandidate);
  const cancelCandidate = useEmployerStore((s) => s.cancelCandidate);
  const loadAll = useEmployerStore((s) => s.loadAll);
  const loadVacancyCandidates = useEmployerStore((s) => s.loadVacancyCandidates);
  const closeShift = useEmployerStore((s) => s.closeShift);
  // Chat only exists once someone's hired (created server-side on accept)
  // — openChatFor below just finds that existing chat to open it, never
  // creates one.
  const chatsLoaded = useChatStore((s) => s.loaded);
  const loadChats = useChatStore((s) => s.load);

  const [ratingOnly, setRatingOnly] = useState(false);
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [closing, setClosing] = useState<Candidate | null>(null);
  const [cancelling, setCancelling] = useState<Candidate | null>(null);

  useEffect(() => {
    if (!vacanciesLoaded) loadAll();
    if (!chatsLoaded) loadChats('company');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (vacancyId) loadVacancyCandidates(vacancyId, vacancy?.positionLabel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vacancyId]);

  const candidates = useMemo(() => allCandidates.filter((c) => c.vacancyId === vacancyId), [allCandidates, vacancyId]);
  const pending = useMemo(() => candidates.filter((c) => c.status === 'pending'), [candidates]);
  // Invited-but-not-confirmed sits alongside confirmed hires — both have a
  // chat open and both are "someone I'm counting on for this shift",
  // they just differ in whether the worker has actually said yes yet.
  const engaged = useMemo(() => candidates.filter((c) => c.status === 'invited' || c.status === 'accepted'), [candidates]);
  const cancelled = useMemo(() => candidates.filter((c) => c.status === 'cancelled'), [candidates]);
  const filtered = useMemo(() => pending.filter((c) => !ratingOnly || c.rating >= 4.5), [pending, ratingOnly]);

  if (!vacancy) {
    if (vacanciesLoaded) navigate('/e/vacancies', { replace: true });
    return null;
  }

  // "Этот день прошёл" — closing (and the mandatory review that comes with
  // it) only makes sense once the shift has actually happened. For a
  // multi-day vacancy that's once the *last* day has passed, not the first.
  const shiftIsPast = (vacancy.endDate ?? vacancy.date) < localDateStr();

  const [top, ...rest] = filtered;

  // The mount effect kicks off loadChats(), but there's nothing stopping a
  // tap on "Написать" before that fetch actually resolves — chats would
  // still read as [] and this would wrongly fall back to the chat list
  // instead of opening the real one. Wait for a fresh load first, and read
  // straight from the store afterwards instead of trusting the `chats`
  // closure, which may be stale by the time the await returns.
  async function openChatFor(candidate: Candidate) {
    if (!useChatStore.getState().loaded) await loadChats('company');
    const chat = useChatStore.getState().chats.find((ch) => ch.workerId === candidate.workerId && ch.shiftId === vacancy!.id);
    navigate(chat ? `/e/chats/${chat.id}` : '/e/chats');
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <TopBar
        onBack={() => navigate(-1)}
        title={`${vacancy.positionLabel} · ${formatDateRange(vacancy.date, vacancy.endDate)}`}
        subtitle={`${String(vacancy.startHour).padStart(2, '0')}:${String(vacancy.startMin).padStart(2, '0')}–${String(vacancy.endHour).padStart(2, '0')}:${String(vacancy.endMin).padStart(2, '0')} · опубликовано ${timeAgoSince(vacancy.createdAt)} назад`}
        right={
          <span className="flex items-center gap-1.5">
            <Badge tone={STATUS_TONE[vacancy.status] ?? 'neutral'}>{STATUS_LABEL[vacancy.status] ?? vacancy.status}</Badge>
            {vacancy.status === 'active' && (
              <button
                onClick={() => navigate(`/e/vacancies/${vacancy.id}/edit`)}
                aria-label="Редактировать вакансию"
                className="h-8 w-8 rounded-full flex items-center justify-center text-text-faint active:text-accent"
              >
                <Pencil size={16} />
              </button>
            )}
          </span>
        }
      />

      <div className="flex gap-2 px-5 pb-3 shrink-0">
        <Chip tone="dark" selected>Отклики · {pending.length}</Chip>
        <Chip tone="dark" selected={ratingOnly} onClick={() => setRatingOnly((v) => !v)}>★4.5+</Chip>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-4">
        {engaged.length > 0 && (
          <div className="space-y-2.5 mb-5">
            {engaged.map((c) => {
              const isClosed = c.workStage === 'employer_closed' || c.workStage === 'reviewed';
              // An invitation the worker never confirmed can always be
              // withdrawn — including after the day has passed, where it
              // would otherwise be stuck forever (closing needs an
              // *accepted* candidate, so there was no way out of it).
              // A confirmed hire can only be cancelled before the shift.
              const canCancel = !isClosed && (c.status === 'invited' || !shiftIsPast);
              return (
                <Card key={c.id} className="p-4">
                  <div className="flex items-center gap-3">
                    <Avatar src={c.photos[0]} name={c.name} size={44} />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-[14px] truncate">{c.name}</p>
                      <p className="text-[12px] text-text-muted">{formatRating(c.rating)} · {c.shiftsCompleted} смен</p>
                    </div>
                    {c.status === 'invited' && <Badge tone="neutral">Ждём подтверждения</Badge>}
                    {isClosed && <Badge tone="accent">Смена закрыта</Badge>}
                  </div>
                  <div className="flex items-center gap-2 mt-4">
                    {!isClosed && c.status !== 'invited' && shiftIsPast && (
                      <Button size="md" className="flex-1" onClick={() => setClosing(c)}>
                        <Check size={14} /> Закрыть смену
                      </Button>
                    )}
                    {!isClosed && c.status !== 'invited' && !shiftIsPast && (
                      <Badge tone="neutral" className="flex-1 !py-2.5 justify-center">Смена ещё впереди</Badge>
                    )}
                    <Button variant="dark" size="icon" onClick={() => openChatFor(c)} aria-label="Написать">
                      <Mail size={16} />
                    </Button>
                    {canCancel && (
                      <IconButton size={40} onClick={() => setCancelling(c)} aria-label="Отменить">
                        <XCircle size={17} className="text-danger" />
                      </IconButton>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {cancelled.length > 0 && (
          <div className="space-y-1.5 mb-5">
            {cancelled.map((c) => (
              <div key={c.id} className="flex items-center gap-3 rounded-card bg-surface-2/60 px-4 py-3">
                <Avatar src={c.photos[0]} name={c.name} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] text-text-muted truncate">
                    {c.name} · {c.cancelledBy === 'worker' ? 'сотрудник отменил' : 'вы отменили'}
                  </p>
                  {c.cancelReason && <p className="text-[12px] text-text-faint truncate">«{c.cancelReason}»</p>}
                </div>
              </div>
            ))}
          </div>
        )}

        {filtered.length === 0 ? (
          <EmptyState title="Никого не осталось" description="Измените фильтры или подождите новых откликов." />
        ) : (
          <>
            {top && (
              <div className="rounded-card bg-surface border border-accent/40 p-4 mb-4">
                <button onClick={() => setSelected(top)} className="flex items-center gap-3 w-full text-left">
                  <Avatar src={top.photos[0]} name={top.name} size={52} />
                  <div className="min-w-0">
                    <p className="font-bold text-[17px]">{top.name}</p>
                    <p className="text-[13px] text-text-muted">{formatRating(top.rating)} · {top.shiftsCompleted} смен</p>
                  </div>
                </button>
                <div className="flex items-center gap-2 mt-4">
                  <Button className="flex-1" onClick={() => decideCandidate(vacancy.id, top.id, 'accepted')}>
                    Пригласить
                  </Button>
                  <Button variant="dark" size="icon" onClick={() => decideCandidate(vacancy.id, top.id, 'declined')} aria-label="Отклонить">
                    <X size={17} />
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-1">
              {rest.map((c) => (
                <div
                  key={c.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelected(c)}
                  onKeyDown={(e) => e.key === 'Enter' && setSelected(c)}
                  className="flex items-center gap-3 py-2.5 w-full text-left cursor-pointer"
                >
                  <Avatar src={c.photos[0]} name={c.name} size={40} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[14px] truncate">{c.name}</p>
                    <p className="text-[12px] text-text-muted truncate">{c.positionLabel} · {formatRating(c.rating)}</p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      decideCandidate(vacancy.id, c.id, 'accepted');
                    }}
                    className="text-[13px] font-semibold text-accent shrink-0"
                  >
                    Пригласить
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <AnimatePresence>
        {selected && (
          <CandidateDetailOverlay
            candidate={selected}
            onClose={() => setSelected(null)}
            acceptLabel="Пригласить"
            onAccept={() => {
              decideCandidate(vacancy.id, selected.id, 'accepted');
              setSelected(null);
            }}
            onDecline={() => {
              decideCandidate(vacancy.id, selected.id, 'declined');
              setSelected(null);
            }}
          />
        )}
      </AnimatePresence>

      {closing && (
        <CloseShiftSheet
          open
          onClose={() => setClosing(null)}
          workerName={closing.name}
          onSubmit={(rating, tags, comment) => closeShift(vacancy.id, closing.id, rating, tags, comment)}
        />
      )}

      {cancelling && (
        <CancelSheet
          open
          onClose={() => setCancelling(null)}
          title={cancelling.status === 'invited' ? 'Отозвать приглашение' : 'Отменить кандидата'}
          description={`${cancelling.name} получит уведомление и причину, чат по этой смене закроется.`}
          confirmLabel={cancelling.status === 'invited' ? 'Отозвать приглашение' : 'Отменить кандидата'}
          onSubmit={(reason) => cancelCandidate(vacancy.id, cancelling.id, reason)}
        />
      )}
    </div>
  );
}

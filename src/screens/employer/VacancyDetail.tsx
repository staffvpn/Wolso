import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Check, Mail, X } from 'lucide-react';
import { TopBar } from '@/components/ui/TopBar';
import { Chip } from '@/components/ui/Chip';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { CandidateDetailOverlay } from '@/components/deck/CandidateDetailOverlay';
import { CloseShiftSheet } from '@/components/CloseShiftSheet';
import { useEmployerStore } from '@/store/useEmployerStore';
import { useChatStore } from '@/store/useChatStore';
import { timeAgoSince } from '@/lib/format';
import type { Candidate } from '@/types';

const STATUS_LABEL: Record<string, string> = {
  active: 'Активна',
  pending_review: 'На модерации',
  rejected: 'Отклонена',
};
const STATUS_TONE: Record<string, 'accent' | 'neutral' | 'danger'> = {
  active: 'accent',
  pending_review: 'neutral',
  rejected: 'danger',
};

export function VacancyDetail() {
  const navigate = useNavigate();
  const { vacancyId } = useParams<{ vacancyId: string }>();
  const vacancy = useEmployerStore((s) => s.vacancies.find((v) => v.id === vacancyId));
  const vacanciesLoaded = useEmployerStore((s) => s.vacancies.length > 0);
  const allCandidates = useEmployerStore((s) => s.candidates);
  const decideCandidate = useEmployerStore((s) => s.decideCandidate);
  const loadAll = useEmployerStore((s) => s.loadAll);
  const loadVacancyCandidates = useEmployerStore((s) => s.loadVacancyCandidates);
  const startChatWithWorker = useChatStore((s) => s.startChatWithWorker);

  const [ratingOnly, setRatingOnly] = useState(false);
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [closing, setClosing] = useState<Candidate | null>(null);
  const closeShift = useEmployerStore((s) => s.closeShift);

  useEffect(() => {
    if (!vacanciesLoaded) loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (vacancyId) loadVacancyCandidates(vacancyId, vacancy?.positionLabel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vacancyId]);

  const candidates = useMemo(() => allCandidates.filter((c) => c.vacancyId === vacancyId), [allCandidates, vacancyId]);
  const pending = useMemo(() => candidates.filter((c) => c.status === 'pending'), [candidates]);
  const accepted = useMemo(() => candidates.filter((c) => c.status === 'accepted'), [candidates]);
  const filtered = useMemo(() => pending.filter((c) => !ratingOnly || c.rating >= 4.5), [pending, ratingOnly]);

  if (!vacancy) {
    if (vacanciesLoaded) navigate('/e/vacancies', { replace: true });
    return null;
  }

  // "Этот день прошёл" — closing (and the mandatory review that comes with
  // it) only makes sense once the shift has actually happened.
  const shiftIsPast = vacancy.date < new Date().toISOString().slice(0, 10);

  const [top, ...rest] = filtered;

  return (
    <div className="flex flex-col h-full min-h-0">
      <TopBar
        onBack={() => navigate(-1)}
        title={`${vacancy.positionLabel} · сегодня`}
        subtitle={`${String(vacancy.startHour).padStart(2, '0')}:${String(vacancy.startMin).padStart(2, '0')}–${String(vacancy.endHour).padStart(2, '0')}:${String(vacancy.endMin).padStart(2, '0')} · опубликовано ${timeAgoSince(vacancy.createdAt)} назад`}
        right={<Badge tone={STATUS_TONE[vacancy.status] ?? 'neutral'}>{STATUS_LABEL[vacancy.status] ?? vacancy.status}</Badge>}
      />

      <div className="flex gap-2 px-5 pb-3 shrink-0">
        <Chip tone="dark" selected>Отклики · {pending.length}</Chip>
        <Chip tone="dark" selected={ratingOnly} onClick={() => setRatingOnly((v) => !v)}>★4.5+</Chip>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-4">
        {accepted.length > 0 && (
          <div className="space-y-2.5 mb-5">
            {accepted.map((c) => (
              <Card key={c.id} className="p-4">
                <div className="flex items-center gap-3">
                  <Avatar name={c.name} size={44} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-[14px] truncate">{c.name}</p>
                    <p className="text-[12px] text-text-muted">★ {c.rating.toFixed(1)} · {c.shiftsCompleted} смен</p>
                  </div>
                  {c.workStage === 'employer_closed' || c.workStage === 'reviewed' ? (
                    <Badge tone="accent">Смена закрыта</Badge>
                  ) : shiftIsPast ? (
                    <Button size="md" onClick={() => setClosing(c)}>
                      <Check size={14} /> Закрыть смену
                    </Button>
                  ) : (
                    <Badge tone="neutral">Смена ещё впереди</Badge>
                  )}
                </div>
              </Card>
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
                  <Avatar name={top.name} size={52} />
                  <div className="min-w-0">
                    <p className="font-bold text-[17px]">{top.name}</p>
                    <p className="text-[13px] text-text-muted">★ {top.rating.toFixed(1)} · {top.shiftsCompleted} смен</p>
                  </div>
                </button>
                <div className="flex items-center gap-2 mt-4">
                  <Button className="flex-1" onClick={() => decideCandidate(vacancy.id, top.id, 'accepted')}>
                    Взять на смену
                  </Button>
                  <Button
                    variant="dark"
                    size="icon"
                    onClick={async () => navigate(`/e/chats/${await startChatWithWorker(top.workerId)}`)}
                    aria-label="Написать"
                  >
                    <Mail size={17} />
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
                  <Avatar name={c.name} size={40} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[14px] truncate">{c.name}</p>
                    <p className="text-[12px] text-text-muted truncate">{c.positionLabel} · ★ {c.rating.toFixed(1)}</p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      decideCandidate(vacancy.id, c.id, 'accepted');
                    }}
                    className="text-[13px] font-semibold text-accent shrink-0"
                  >
                    Взять
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
            onAccept={() => {
              decideCandidate(vacancy.id, selected.id, 'accepted');
              setSelected(null);
            }}
            onDecline={() => {
              decideCandidate(vacancy.id, selected.id, 'declined');
              setSelected(null);
            }}
            onMessage={async () => {
              const chatId = await startChatWithWorker(selected.workerId);
              navigate(`/e/chats/${chatId}`);
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
    </div>
  );
}

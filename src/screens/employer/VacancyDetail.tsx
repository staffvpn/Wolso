import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Mail, X } from 'lucide-react';
import { TopBar } from '@/components/ui/TopBar';
import { Chip } from '@/components/ui/Chip';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { useEmployerStore } from '@/store/useEmployerStore';
import { useChatStore } from '@/store/useChatStore';
import { timeAgoSince } from '@/lib/format';

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
  const filtered = useMemo(() => pending.filter((c) => !ratingOnly || c.rating >= 4.5), [pending, ratingOnly]);

  if (!vacancy) {
    if (vacanciesLoaded) navigate('/e/vacancies', { replace: true });
    return null;
  }

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
        {filtered.length === 0 ? (
          <EmptyState title="Никого не осталось" description="Измените фильтры или подождите новых откликов." />
        ) : (
          <>
            {top && (
              <div className="rounded-card bg-surface border border-accent/40 p-4 mb-4">
                <div className="flex items-center gap-3">
                  <Avatar name={top.name} size={52} />
                  <div className="min-w-0">
                    <p className="font-bold text-[17px]">{top.name}</p>
                    <p className="text-[13px] text-text-muted">★ {top.rating.toFixed(1)} · {top.shiftsCompleted} смен</p>
                  </div>
                </div>
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
                <div key={c.id} className="flex items-center gap-3 py-2.5">
                  <Avatar name={c.name} size={40} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[14px] truncate">{c.name}</p>
                    <p className="text-[12px] text-text-muted truncate">{c.positionLabel} · ★ {c.rating.toFixed(1)}</p>
                  </div>
                  <button
                    onClick={() => decideCandidate(vacancy.id, c.id, 'accepted')}
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
    </div>
  );
}

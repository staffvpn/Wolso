import type { Candidate } from '@/types';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { SectionLabel } from '../ui/Card';
import { formatDistance } from '@/lib/format';

export function CandidateCard({ candidate }: { candidate: Candidate }) {
  return (
    <div className="flex flex-col h-full p-5 overflow-y-auto">
      <Avatar name={candidate.name} size={72} />
      <h2 className="text-[24px] font-extrabold mt-4">{candidate.name}</h2>
      <p className="text-[14px] text-text-muted mt-0.5">
        {candidate.positionLabel} · {formatDistance(candidate.distanceKm)} от вас
      </p>

      <div className="flex flex-wrap gap-2 mt-3">
        <Badge tone="accent">★ {candidate.rating} · {candidate.shiftsCompleted} смен</Badge>
        {candidate.online && <Badge tone="dark">Онлайн</Badge>}
      </div>

      {candidate.skills.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {candidate.skills.map((s) => (
            <Badge key={s} tone="neutral">{s}</Badge>
          ))}
        </div>
      )}

      {candidate.experience.length > 0 && (
        <div className="mt-6">
          <SectionLabel>Опыт</SectionLabel>
          <div className="space-y-2.5">
            {candidate.experience.map((e, i) => (
              <div key={i} className="flex items-center justify-between text-[14px]">
                <span className="font-medium">{e.role} · {e.place}</span>
                <span className="text-text-muted">{e.period}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1" />

      {candidate.review && (
        <div className="rounded-2xl bg-surface-2 p-4 mt-4">
          <SectionLabel className="mb-1.5">Отзыв заведения</SectionLabel>
          <p className="text-[14px] leading-relaxed text-text">
            «{candidate.review.text}» — {candidate.review.company}
          </p>
        </div>
      )}
    </div>
  );
}

import type { Candidate } from '@/types';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';

export function CandidateCard({ candidate }: { candidate: Candidate }) {
  return (
    <div className="flex flex-col h-full p-5 overflow-y-auto">
      <Avatar name={candidate.name} size={72} />
      <h2 className="text-[24px] font-extrabold mt-4">{candidate.name}</h2>
      <p className="text-[14px] text-text-muted mt-0.5">
        {candidate.positionLabel} · {candidate.city}
      </p>

      <div className="flex flex-wrap gap-2 mt-3">
        <Badge tone="accent">★ {candidate.rating.toFixed(1)} · {candidate.shiftsCompleted} смен</Badge>
        {candidate.medBook && <Badge tone="dark">Медкнижка</Badge>}
      </div>

      <div className="flex-1" />
    </div>
  );
}

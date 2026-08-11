import { create } from 'zustand';
import type { ComplaintItem, DocumentReview, ModerationStatus, ModerationVacancy } from '@/types';
import { COMPLAINTS, DOCUMENT_REVIEWS, MODERATION_QUEUE } from '@/data/moderation';
import { useAuditStore } from './useAuditStore';
import { useCurrentMember, useCurrentRole } from './useSessionStore';

interface ModerationState {
  vacancies: ModerationVacancy[];
  complaints: ComplaintItem[];
  documents: DocumentReview[];
  decideVacancy: (id: string, status: ModerationStatus, actor: { name: string; role: string }) => void;
  decideComplaint: (id: string, status: ModerationStatus, actor: { name: string; role: string }) => void;
  decideDocument: (id: string, status: ModerationStatus, actor: { name: string; role: string }) => void;
}

const STATUS_VERB: Record<ModerationStatus, string> = {
  approved: 'одобрил(а)',
  returned: 'вернул(а) на правку',
  rejected: 'отклонил(а)',
  pending: 'вернул(а) в очередь',
};

export const useModerationStore = create<ModerationState>((set) => ({
  vacancies: MODERATION_QUEUE,
  complaints: COMPLAINTS,
  documents: DOCUMENT_REVIEWS,

  decideVacancy: (id, status, actor) => {
    const item = MODERATION_QUEUE.find((v) => v.id === id);
    set((s) => ({ vacancies: s.vacancies.map((v) => (v.id === id ? { ...v, status } : v)) }));
    if (item) {
      useAuditStore.getState().log(
        actor.name,
        actor.role,
        `${STATUS_VERB[status]} вакансию «${item.position} · ${item.companyName}»`,
        status === 'rejected' ? 'danger' : status === 'approved' ? 'accent' : 'neutral',
      );
    }
  },

  decideComplaint: (id, status, actor) => {
    const item = COMPLAINTS.find((c) => c.id === id);
    set((s) => ({ complaints: s.complaints.map((c) => (c.id === id ? { ...c, status } : c)) }));
    if (item) {
      useAuditStore.getState().log(actor.name, actor.role, `${STATUS_VERB[status]} жалобу на «${item.targetName}»`, status === 'rejected' ? 'danger' : 'neutral');
    }
  },

  decideDocument: (id, status, actor) => {
    const item = DOCUMENT_REVIEWS.find((d) => d.id === id);
    set((s) => ({ documents: s.documents.map((d) => (d.id === id ? { ...d, status } : d)) }));
    if (item) {
      useAuditStore.getState().log(actor.name, actor.role, `${STATUS_VERB[status]} документ «${item.docType}» — ${item.applicantName}`, status === 'rejected' ? 'danger' : 'accent');
    }
  },
}));

/** Convenience: current demo actor shorthand for audit logging from screens. */
export function useCurrentActor() {
  const member = useCurrentMember();
  const role = useCurrentRole();
  return { name: member.name, role: role.name };
}

import { create } from 'zustand';
import type { VacancyRecord } from '@/types';
import { VACANCIES } from '@/data/vacancies';
import { useAuditStore } from './useAuditStore';

interface VacanciesState {
  vacancies: VacancyRecord[];
  closeVacancy: (id: string, actor: { name: string; role: string }) => void;
}

export const useVacanciesStore = create<VacanciesState>((set, get) => ({
  vacancies: VACANCIES,
  closeVacancy: (id, actor) => {
    const item = get().vacancies.find((v) => v.id === id);
    set((s) => ({ vacancies: s.vacancies.map((v) => (v.id === id ? { ...v, status: 'closed' } : v)) }));
    if (item) useAuditStore.getState().log(actor.name, actor.role, `закрыла вакансию «${item.position} · ${item.companyName}»`, 'neutral');
  },
}));

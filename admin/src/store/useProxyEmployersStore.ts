import { create } from 'zustand';
import type { ProxyEmployer, ProxyEmployerInput, ProxyVacancy, ProxyVacancyInput } from '@/types';
import {
  createProxyEmployer,
  createProxyVacancy,
  deleteProxyEmployer,
  deleteProxyEmployerPhoto,
  deleteProxyVacancy,
  fetchProxyEmployers,
  fetchProxyVacancies,
  updateProxyEmployer,
  updateProxyVacancy,
  uploadProxyEmployerAvatar,
  uploadProxyEmployerPhoto,
} from '@/services/proxyEmployersApi';

interface ProxyEmployersState {
  employers: ProxyEmployer[];
  loading: boolean;
  loaded: boolean;
  /** Код ошибки с сервера — отдельно от общего падения, чтобы экран мог
   *  назвать недостающую миграцию, а не показать «что-то пошло не так». */
  error: string | null;

  /** Вакансии открытого сейчас работодателя — по одному набору за раз,
   *  этого достаточно: список работодателей не открывает вакансии сразу
   *  нескольких карточек одновременно. */
  vacancies: ProxyVacancy[];
  vacanciesLoading: boolean;
  vacanciesFor: string | null;

  load: () => Promise<void>;
  create: (input: ProxyEmployerInput) => Promise<string>;
  update: (id: string, input: Partial<ProxyEmployerInput>) => Promise<void>;
  setAvatar: (id: string, file: File) => Promise<void>;
  addPhoto: (id: string, file: File) => Promise<void>;
  removePhoto: (id: string, photoId: string) => Promise<void>;
  remove: (id: string) => Promise<void>;

  loadVacancies: (employerId: string) => Promise<void>;
  createVacancy: (employerId: string, input: ProxyVacancyInput) => Promise<void>;
  updateVacancy: (employerId: string, vacancyId: string, input: Partial<ProxyVacancyInput>) => Promise<void>;
  removeVacancy: (employerId: string, vacancyId: string) => Promise<void>;
}

export const useProxyEmployersStore = create<ProxyEmployersState>((set, get) => ({
  employers: [],
  loading: false,
  loaded: false,
  error: null,
  vacancies: [],
  vacanciesLoading: false,
  vacanciesFor: null,

  load: async () => {
    set({ loading: true, error: null });
    try {
      set({ employers: await fetchProxyEmployers(), loading: false, loaded: true });
    } catch (err) {
      set({ loading: false, loaded: true, error: (err as { code?: string }).code ?? 'unknown' });
    }
  },

  create: async (input) => {
    const id = await createProxyEmployer(input);
    await get().load();
    return id;
  },

  update: async (id, input) => {
    await updateProxyEmployer(id, input);
    await get().load();
  },

  setAvatar: async (id, file) => {
    await uploadProxyEmployerAvatar(id, file);
    await get().load();
  },

  addPhoto: async (id, file) => {
    await uploadProxyEmployerPhoto(id, file);
    await get().load();
  },

  removePhoto: async (id, photoId) => {
    await deleteProxyEmployerPhoto(id, photoId);
    await get().load();
  },

  remove: async (id) => {
    await deleteProxyEmployer(id);
    set({ employers: get().employers.filter((e) => e.id !== id) });
  },

  loadVacancies: async (employerId) => {
    set({ vacanciesLoading: true, vacanciesFor: employerId });
    const vacancies = await fetchProxyVacancies(employerId);
    // Могли успеть открыть другую карточку, пока грузился этот запрос —
    // тогда результат уже не про то, что сейчас на экране.
    if (get().vacanciesFor === employerId) set({ vacancies, vacanciesLoading: false });
  },

  createVacancy: async (employerId, input) => {
    await createProxyVacancy(employerId, input);
    await get().loadVacancies(employerId);
    await get().load();
  },

  updateVacancy: async (employerId, vacancyId, input) => {
    await updateProxyVacancy(employerId, vacancyId, input);
    await get().loadVacancies(employerId);
  },

  removeVacancy: async (employerId, vacancyId) => {
    await deleteProxyVacancy(employerId, vacancyId);
    await get().loadVacancies(employerId);
    await get().load();
  },
}));

import { create } from 'zustand';
import type { WorkerDocument } from '@/types';
import { WORKER_PROFILE } from '@/data/profile';
import { hapticNotify } from '@/lib/telegram';

interface DocumentsState {
  documents: WorkerDocument[];
  upload: (id: string) => void;
}

export const useDocumentsStore = create<DocumentsState>((set) => ({
  documents: WORKER_PROFILE.documents,
  upload: (id) => {
    set((s) => ({ documents: s.documents.map((d) => (d.id === id ? { ...d, status: 'pending' } : d)) }));
    setTimeout(() => {
      set((s) => ({
        documents: s.documents.map((d) => (d.id === id ? { ...d, status: 'verified', note: 'Проверен только что' } : d)),
      }));
      hapticNotify('success');
    }, 1600);
  },
}));

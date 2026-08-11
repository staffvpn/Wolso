import { create } from 'zustand';
import type { WorkerDocument, WorkerExperience } from '@/types';
import { fetchMyProfile, uploadDocument as uploadDocumentApi } from '@/services/profileApi';
import { hapticNotify } from '@/lib/telegram';

interface ProfileState {
  name: string;
  city: string;
  rating: number;
  shiftsCompleted: number;
  profileCompletion: number;
  referralCode: string;
  positions: WorkerExperience[];
  documents: WorkerDocument[];
  loading: boolean;
  loaded: boolean;
  load: () => Promise<void>;
  uploadDocument: (docId: string, file: File) => Promise<void>;
}

export const useProfileStore = create<ProfileState>((set) => ({
  name: '',
  city: '',
  rating: 0,
  shiftsCompleted: 0,
  profileCompletion: 0,
  referralCode: '',
  positions: [],
  documents: [],
  loading: false,
  loaded: false,

  load: async () => {
    set({ loading: true });
    try {
      const profile = await fetchMyProfile();
      set({ ...profile, loading: false, loaded: true });
    } catch {
      set({ loading: false });
    }
  },

  uploadDocument: async (docId, file) => {
    set((s) => ({ documents: s.documents.map((d) => (d.id === docId ? { ...d, status: 'pending', note: 'Загружаем…' } : d)) }));
    try {
      await uploadDocumentApi(docId, file);
      set((s) => ({ documents: s.documents.map((d) => (d.id === docId ? { ...d, status: 'pending', note: 'На проверке' } : d)) }));
      hapticNotify('success');
    } catch {
      // Roll back to what the server last confirmed.
      const profile = await fetchMyProfile().catch(() => null);
      if (profile) set({ documents: profile.documents });
      else set((s) => ({ documents: s.documents.map((d) => (d.id === docId ? { ...d, status: 'missing', note: undefined } : d)) }));
    }
  },
}));

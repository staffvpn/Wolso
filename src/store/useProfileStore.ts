import { create } from 'zustand';
import type { WorkerDocument, WorkerExperience, YesNo } from '@/types';
import {
  fetchMyProfile,
  updateMyProfile,
  addExperience,
  uploadDocument as uploadDocumentApi,
  uploadAvatar as uploadAvatarApi,
  uploadPortfolioPhoto as uploadPortfolioPhotoApi,
  deletePortfolioPhoto as deletePortfolioPhotoApi,
  type ProfileUpdate,
} from '@/services/profileApi';
import { hapticNotify } from '@/lib/telegram';

interface ProfileState {
  name: string;
  city: string;
  rating: number;
  shiftsCompleted: number;
  profileCompletion: number;
  profileComplete: boolean;
  referralCode: string;
  bio: string;
  skills: string;
  birthdate?: string;
  age?: number;
  smoking?: YesNo;
  alcohol?: YesNo;
  avatarUrl?: string;
  positions: WorkerExperience[];
  documents: WorkerDocument[];
  photos: { id: string; url: string }[];
  loading: boolean;
  loaded: boolean;
  load: () => Promise<void>;
  updateProfile: (update: ProfileUpdate) => Promise<void>;
  addPosition: (exp: WorkerExperience) => Promise<void>;
  uploadAvatar: (file: File) => Promise<void>;
  uploadPhoto: (file: File) => Promise<void>;
  deletePhoto: (id: string) => Promise<void>;
  uploadDocument: (docId: string, file: File) => Promise<void>;
}

export const useProfileStore = create<ProfileState>((set) => ({
  name: '',
  city: '',
  rating: 0,
  shiftsCompleted: 0,
  profileCompletion: 0,
  profileComplete: false,
  referralCode: '',
  bio: '',
  skills: '',
  positions: [],
  documents: [],
  photos: [],
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

  updateProfile: async (update) => {
    const profile = await updateMyProfile(update);
    set({ ...profile, loaded: true });
    hapticNotify('success');
  },

  addPosition: async (exp) => {
    const profile = await addExperience(exp);
    set({ ...profile, loaded: true });
  },

  uploadAvatar: async (file) => {
    const profile = await uploadAvatarApi(file);
    set({ ...profile, loaded: true });
    hapticNotify('success');
  },

  uploadPhoto: async (file) => {
    const profile = await uploadPortfolioPhotoApi(file);
    set({ ...profile, loaded: true });
    hapticNotify('success');
  },

  deletePhoto: async (id) => {
    const profile = await deletePortfolioPhotoApi(id);
    set({ ...profile, loaded: true });
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

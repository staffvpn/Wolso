import { create } from 'zustand';
import type { WorkerExperience } from '@/types';
import {
  fetchMyProfile,
  updateMyProfile,
  addExperience,
  deleteExperience,
  uploadAvatar as uploadAvatarApi,
  uploadPortfolioPhoto as uploadPortfolioPhotoApi,
  deletePortfolioPhoto as deletePortfolioPhotoApi,
  type ProfileUpdate,
} from '@/services/profileApi';
import { hapticNotify } from '@/lib/telegram';
import { ApiError } from '@/lib/apiClient';
import { useAuthStore } from './useAuthStore';

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
  avatarUrl?: string;
  positions: WorkerExperience[];
  photos: { id: string; url: string }[];
  loading: boolean;
  loaded: boolean;
  error: boolean;
  load: () => Promise<void>;
  updateProfile: (update: ProfileUpdate) => Promise<void>;
  addPosition: (exp: Omit<WorkerExperience, 'id'>) => Promise<void>;
  deletePosition: (id: string) => Promise<void>;
  uploadAvatar: (file: File) => Promise<void>;
  uploadPhoto: (file: File) => Promise<void>;
  deletePhoto: (id: string) => Promise<void>;
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
  photos: [],
  loading: false,
  loaded: false,
  error: false,

  load: async () => {
    set({ loading: true, error: false });
    try {
      const profile = await fetchMyProfile();
      set({ ...profile, loading: false, loaded: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        // The worker row this session points to is gone — deleted from
        // the admin dashboard. Force back through /auth/telegram instead
        // of sitting on a permanent "не удалось загрузить": a fresh
        // bootstrap discovers there's no account anymore and routes to
        // the role-choice screen, same as it would for a new signup.
        useAuthStore.getState().signOut();
        return;
      }
      // WorkerProfileGate (AuthGate.tsx) blocks the entire app on `loaded`
      // — a request that fails and never resolves it would soft-lock every
      // worker session on a spinner forever, so this has to settle either way.
      set({ loading: false, loaded: true, error: true });
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

  deletePosition: async (id) => {
    const profile = await deleteExperience(id);
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
}));

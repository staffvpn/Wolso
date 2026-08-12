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

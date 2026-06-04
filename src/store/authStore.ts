import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AuthUser {
  name: string;
  email: string;
  username: string;
  level: number;
  elo: number;
  rank: string;
  provider: 'google' | 'email';
}

interface AuthStore {
  user: AuthUser | null;
  login: (user: AuthUser) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      login: (user) => set({ user }),
      logout: () => set({ user: null }),
    }),
    { name: 'hexbandit-auth' }
  )
);

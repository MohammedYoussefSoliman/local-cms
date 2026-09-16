import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

import type { User } from '@cms/domain';

type AuthStore = {
  // --- State ---
  /**
   * Access token is kept in memory only. Persisting it to localStorage makes
   * it readable by any XSS on the page; the refresh token restores the session
   * across reloads instead (arch doc §5).
   */
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  // --- Actions ---
  setSession: (session: {
    accessToken: string;
    refreshToken: string;
    user: User;
  }) => void;
  setAccessToken: (accessToken: string) => void;
  clear: () => void;
};

export const useAuthStore = create<AuthStore>()(
  devtools(
    persist(
      (set) => ({
        accessToken: null,
        refreshToken: null,
        user: null,
        setSession: ({ accessToken, refreshToken, user }) =>
          set({ accessToken, refreshToken, user }),
        setAccessToken: (accessToken) => set({ accessToken }),
        clear: () => set({ accessToken: null, refreshToken: null, user: null }),
      }),
      {
        name: 'cms-dashboard-auth-storage',
        // Only the refresh token and user survive a reload.
        partialize: (state) => ({
          refreshToken: state.refreshToken,
          user: state.user,
        }),
      },
    ),
    { name: 'Auth Store' },
  ),
);

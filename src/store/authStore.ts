import { create } from 'zustand';
import type { CurrentUser, LoginResponse } from '@/types/auth';
import { sanitizeDisplayText } from '@/lib/safeText';

// 身份只保留在内存中；刷新后由 /auth/me 恢复，绝不信任 localStorage 的角色。
interface AuthState {
  user: CurrentUser | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
  sessionVersion: number;
  setCurrentUser: (user: CurrentUser) => void;
  setUserFromLogin: (data: LoginResponse) => void;
  clearUser: () => void;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  isAuthenticated: false,
  isInitialized: false,
  sessionVersion: 0,
  setCurrentUser: (user) => {
    if (!Number.isInteger(user.userId) || ![0, 1, 2].includes(user.role)) {
      get().clearUser();
      throw new Error('Invalid session response');
    }
    set((state) => ({
      user: {
        userId: user.userId,
        username: sanitizeDisplayText(user.username),
        email: user.email,
        role: user.role,
        userGroup: user.userGroup,
        telephone: user.telephone,
        qqId: user.qqId,
      },
      isAuthenticated: true,
      isInitialized: true,
      sessionVersion: state.sessionVersion + 1,
    }));
  },
  setUserFromLogin: (data) => get().setCurrentUser(data),
  clearUser: () => set((state) => ({
    user: null,
    isAuthenticated: false,
    isInitialized: true,
    sessionVersion: state.sessionVersion + 1,
  })),
}));

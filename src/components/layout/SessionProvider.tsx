'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getCurrentUser } from '@/lib/api/auth';
import { tokenStore } from '@/lib/api/client';
import { useAuthStore } from '@/store/authStore';

export function SessionProvider() {
  const queryClient = useQueryClient();

  useEffect(() => {
    let active = true;
    let pending = false;
    // 旧版本持久化资料已不再参与身份判断。
    localStorage.removeItem('cnss-auth');
    const unsubscribe = useAuthStore.subscribe((state, previous) => {
      if (state.user?.userId !== previous.user?.userId || state.user?.role !== previous.user?.role) {
        queryClient.clear();
      }
    });

    async function verifySession() {
      if (pending) return;
      if (!tokenStore.getAccess() && !tokenStore.getRefresh()) {
        useAuthStore.getState().clearUser();
        return;
      }
      pending = true;
      const version = useAuthStore.getState().sessionVersion;
      try {
        const user = await getCurrentUser();
        // 迟到的响应不得覆盖期间发生的登录或退出。
        if (active && useAuthStore.getState().sessionVersion === version) {
          useAuthStore.getState().setCurrentUser(user);
        }
      } catch {
        if (active && useAuthStore.getState().sessionVersion === version) {
          useAuthStore.getState().clearUser();
        }
      } finally {
        pending = false;
      }
    }

    function onStorage(event: StorageEvent) {
      if (event.key === null || event.key === 'cnss_access_token' || event.key === 'cnss_refresh_token') {
        useAuthStore.getState().clearUser();
        void verifySession();
      }
    }
    void verifySession();
    window.addEventListener('focus', verifySession);
    window.addEventListener('storage', onStorage);
    return () => {
      active = false;
      unsubscribe();
      window.removeEventListener('focus', verifySession);
      window.removeEventListener('storage', onStorage);
    };
  }, [queryClient]);

  return null;
}

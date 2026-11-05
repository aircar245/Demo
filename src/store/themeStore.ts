import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * 主题状态（zustand + persist）
 * - 默认暗色模式
 * - localStorage key: 'cnss-theme'
 * - 由 layout.tsx ThemeProvider 在挂载时同步到 <html data-theme>
 */
type Theme = 'dark' | 'light';

interface ThemeState {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'dark',
      toggleTheme: () =>
        set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
      setTheme: (t) => set({ theme: t }),
    }),
    {
      name: 'cnss-theme',
      // skipHydration: ThemeProvider 在 mount 时手动调用 rehydrate，
      // 确保 data-theme 写入与 localStorage 读取在同一个同步任务里完成，
      // 避免首次 render 用默认值、hydration 后才更新导致的闪烁或丢失。
      skipHydration: true,
    },
  ),
);

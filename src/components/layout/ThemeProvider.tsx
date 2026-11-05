'use client';

import { useEffect } from 'react';
import { useThemeStore } from '@/store/themeStore';

/**
 * ThemeProvider — 挂载时从 localStorage rehydrate 并同步到 <html data-theme>
 *
 * 为什么用 skipHydration + 手动 rehydrate：
 * zustand persist 默认在 store 创建时异步 rehydrate，导致首次渲染使用默认值
 * ('dark')，hydration 完成后才更新，可能造成 data-theme 写入时机晚于页面渲染。
 * skipHydration=true + 在此组件 mount 时同步调用 rehydrate，确保时序正确。
 */
export function ThemeProvider() {
  const theme = useThemeStore((s) => s.theme);

  useEffect(() => {
    // 手动触发 localStorage rehydrate（因为 store 设置了 skipHydration: true）
    void useThemeStore.persist.rehydrate();
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    if (theme === 'light') {
      html.setAttribute('data-theme', 'light');
    } else {
      html.removeAttribute('data-theme');
    }
  }, [theme]);

  return null;
}

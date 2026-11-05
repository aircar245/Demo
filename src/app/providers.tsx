'use client';

import { SessionProvider } from '@/components/layout/SessionProvider';
import { MotionConfig } from 'framer-motion';
import { AchievementNotifications } from '@/components/achievements/AchievementNotifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

/**
 * TanStack Query 的全局 Provider。
 * 用它包裹整个 app，之后任何组件就能用 useQuery/useMutation 拉取后端数据，
 * 自动处理 loading / error / 缓存，不用手写一堆 useState。
 *
 * 'use client' 必须写在最上面：Next App Router 默认是服务端组件，
 * 而这里需要在浏览器端创建 QueryClient。
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  // 用 useState 确保 QueryClient 只创建一次（不会每次渲染都新建）
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000, // 30秒内数据视为新鲜，不重复请求
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={client}><MotionConfig reducedMotion="user"><SessionProvider />{children}<AchievementNotifications /></MotionConfig></QueryClientProvider>
  );
}

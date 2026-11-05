'use client';

import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';

export function AdminAccess({ children }: { children: React.ReactNode }) {
  const { user, isInitialized } = useAuthStore();
  if (!isInitialized) return <div className="p-8" role="status">正在核验登录身份…</div>;
  if (!user) return <div className="p-8">请先<Link href="/login" className="underline">登录</Link>。</div>;
  if (user.role === 0) return <div className="p-8" role="alert">仅管理员可访问。</div>;
  return children;
}

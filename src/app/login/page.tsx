'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { login } from '@/lib/api/auth';
import { useAuthStore } from '@/store/authStore';

/**
 * 登录页 — Overwatch 风格
 * 对接后端 POST /auth/login
 * 字段：emailorusername + password（来自后端 loginDto）
 */
export default function LoginPage() {
  const router = useRouter();
  const setUserFromLogin = useAuthStore((s) => s.setUserFromLogin);

  const [form, setForm] = useState({ emailorusername: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.emailorusername || !form.password) {
      setError('请填写所有字段');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await login(form);
      setUserFromLogin(data);
      const returnTo = new URLSearchParams(window.location.search).get('returnTo');
      const safeReturnTo =
        returnTo?.startsWith('/') && !returnTo.startsWith('//')
          ? returnTo
          : '/challenges';
      router.push(safeReturnTo);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })
          ?.response?.data?.message ?? '登录失败，请检查账号密码';
      setError(typeof msg === 'string' ? msg : '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-[calc(100dvh-3rem)] flex items-center justify-center px-4"
      style={{ background: 'var(--ow-bg)' }}
    >
      {/* 点阵背景 */}
      <div className="absolute inset-0 ow-dots pointer-events-none opacity-40" />

      <motion.div
        initial={false}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
        className="relative z-10 w-full max-w-md border"
        style={{ borderColor: 'var(--ow-border)', background: 'var(--ow-panel-bg-main)' }}
      >
        {/* 四角装饰 */}
        <span className="ow-corner ow-corner-tl" />
        <span className="ow-corner ow-corner-tr" />
        <span className="ow-corner ow-corner-bl" />
        <span className="ow-corner ow-corner-br" />

        <div className="p-8 flex flex-col gap-6">

          {/* 标题区 */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2" style={{ background: '#3FB950' }} />
              <span className="ow-mono text-[9px] tracking-widest uppercase"
                style={{ color: 'var(--ow-text-muted)' }}>
                CNSS_2026 / AUTH / LOGIN
              </span>
            </div>
            <h1
              className="font-['Inter'] text-3xl font-light tracking-tight"
              style={{ color: 'var(--ow-text)' }}
            >
              LOGIN
            </h1>
            <p className="ow-mono text-[10px] tracking-widest uppercase"
              style={{ color: 'var(--ow-text-muted)' }}>
              使用邮箱或用户名登录
              <span
                className="inline-block w-[6px] h-[10px] ml-1 align-middle"
                style={{
                  background: 'var(--ow-text-muted)',
                  animation: '1s step-end 0s infinite normal none running ow-blink',
                }}
              />
            </p>
          </div>

          <div className="border-t" style={{ borderColor: 'var(--ow-border)' }} />

          {/* 表单 */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">

            {/* 邮箱/用户名 */}
            <div className="flex flex-col gap-1.5">
              <label className="ow-mono text-[9px] tracking-widest uppercase"
                style={{ color: 'var(--ow-text-muted)' }}>
                EMAIL_OR_USERNAME
              </label>
              <div className="flex items-center gap-2 border px-3 py-2.5"
                style={{ borderColor: 'var(--ow-border)', background: 'var(--ow-panel)' }}>
                <span className="ow-mono text-sm" style={{ color: 'var(--ow-text-muted)' }}>&gt;</span>
                <input
                  type="text"
                  autoComplete="username"
                  placeholder="user@example.com"
                  value={form.emailorusername}
                  onChange={(e) => setForm(f => ({ ...f, emailorusername: e.target.value }))}
                  className="flex-1 bg-transparent outline-none ow-mono text-sm"
                  style={{ color: 'var(--ow-text)' }}
                />
              </div>
            </div>

            {/* 密码 */}
            <div className="flex flex-col gap-1.5">
              <label className="ow-mono text-[9px] tracking-widest uppercase"
                style={{ color: 'var(--ow-text-muted)' }}>
                PASSWORD
              </label>
              <div className="flex items-center gap-2 border px-3 py-2.5"
                style={{ borderColor: 'var(--ow-border)', background: 'var(--ow-panel)' }}>
                <span className="ow-mono text-sm" style={{ color: 'var(--ow-text-muted)' }}>&gt;</span>
                <input
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))}
                  className="flex-1 bg-transparent outline-none ow-mono text-sm"
                  style={{ color: 'var(--ow-text)' }}
                />
              </div>
            </div>

            {/* 错误提示 */}
            {error && (
              <motion.div
                initial={false}
                animate={{ opacity: 1, y: 0 }}
                className="ow-mono text-[11px] px-3 py-2 border"
                style={{ color: '#E12E38', borderColor: '#E12E38', background: 'rgba(225,46,56,0.06)' }}
              >
                ERR: {error}
              </motion.div>
            )}

            {/* 提交按钮 */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 border ow-mono text-[11px] uppercase tracking-widest
                         transition-colors duration-150 mt-2 disabled:opacity-40"
              style={{
                borderColor: loading ? '#3A3A3A' : '#8A8A8A',
                color: loading ? '#555' : '#F5F5F5',
                background: loading ? 'transparent' : 'rgba(255,255,255,0.03)',
              }}
            >
              {loading ? '> AUTHENTICATING...' : '[ EXECUTE LOGIN ]'}
            </button>
          </form>

          <div className="border-t" style={{ borderColor: 'var(--ow-border)' }} />

          {/* 底部状态 + 注册/重置入口 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-1.5 h-1.5 rounded-full"
                style={{ background: '#3FB950', boxShadow: '0 0 6px rgba(63,185,80,0.5)' }} />
              <span className="ow-mono text-[9px] tracking-widest uppercase" style={{ color: 'var(--ow-text-muted)' }}>
                CNSS_2026 / SESSION:SECURE / TLS:OK
              </span>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <a href="/register"
                className="ow-mono text-[10px] uppercase tracking-widest transition-colors whitespace-nowrap"
                style={{ color: 'var(--ow-text-muted)' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#8A8A8A')}
                onMouseLeave={e => (e.currentTarget.style.color = '#555')}
              >
                没有账号 → [ REGISTER ]
              </a>
              <a href="/reset-password"
                className="ow-mono text-[10px] uppercase tracking-widest transition-colors whitespace-nowrap"
                style={{ color: 'var(--ow-text-muted)' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#8A8A8A')}
                onMouseLeave={e => (e.currentTarget.style.color = '#555')}
              >
                忘记密码 → [ RESET ]
              </a>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

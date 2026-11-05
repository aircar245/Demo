'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { useThemeStore } from '@/store/themeStore';
import { tokenStore } from '@/lib/api/client';
import { GlitchText } from '@/components/ow/GlitchText';
import { getUserCount } from '@/lib/api/user';
import { launchNscc } from '@/lib/nscc';

/**
 * Navbar — Overwatch 风格 + GlitchText 文字动画
 * 滑入后所有文字以乱码增长方式揭示
 * 所有颜色通过 CSS 变量驱动，支持日间/夜间主题切换。
 */
export function Navbar() {
  const { isAuthenticated, user, clearUser } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const router = useRouter();

  const { data: memberCount } = useQuery({
    queryKey: ['user-count'],
    queryFn: getUserCount,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const [menuOpen, setMenuOpen] = useState(false);
  const [menuReady, setMenuReady] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [userMenuReady, setUserMenuReady] = useState(false);
  const pathname = usePathname();
  useEffect(() => { setMenuOpen(false); setUserMenuOpen(false); }, [pathname]);

  useEffect(() => {
    if (menuOpen) {
      const t = setTimeout(() => setMenuReady(true), 50);
      return () => clearTimeout(t);
    } else {
      setMenuReady(false);
    }
  }, [menuOpen]);

  useEffect(() => {
    if (userMenuOpen) {
      const t = setTimeout(() => setUserMenuReady(true), 50);
      return () => clearTimeout(t);
    } else {
      setUserMenuReady(false);
    }
  }, [userMenuOpen]);

  function handleLogout() {
    tokenStore.clear();
    clearUser();
    router.push('/');
  }

  function handleNsccLogin() {
    void launchNscc().catch((error: unknown) => {
      window.alert(error instanceof Error ? error.message : '无法进入 NSCC');
    });
  }

  const navItems = [
    { href: '/challenges', label: 'CHALLENGES' },
    { href: '/leaderboard', label: 'LEADERBOARD' },
    ...(isAuthenticated ? [{ href: '/profile', label: 'PROFILE' }] : []),
    ...(((user?.role ?? 0) > 0) ? [{ href: '/admin', label: 'ADMIN' }] : []),
  ];

  return (
    <motion.header
      initial={false}
      animate={{ y: 0 }}
      transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
      className="h-12 w-full shrink-0 border-b bg-[var(--ow-panel-bg-topbar)]
                 flex items-center justify-between px-4 md:px-6
                 ow-mono text-[10px] z-50 relative select-none sticky top-0
                 backdrop-blur-md"
      style={{ borderColor: 'var(--ow-border)' }}
    >
      {/* 左：汉堡（移动端）+ Logo + 导航 */}
      <div className="flex items-center gap-3 md:gap-6">
        {/* 汉堡按钮 — 仅移动端 */}
        <button
          className="flex flex-col justify-center gap-[5px] md:hidden shrink-0"
          style={{ width: 20, height: 20 }}
          onClick={() => setMenuOpen(v => !v)}
          aria-label="Toggle navigation"
        >
          <span
            className="block h-px w-full transition-all duration-200"
            style={{
              background: 'var(--nav-icon)',
              transform: menuOpen ? 'translateY(6px) rotate(45deg)' : 'none',
            }}
          />
          <span
            className="block h-px w-full transition-all duration-200"
            style={{
              background: 'var(--nav-icon)',
              opacity: menuOpen ? 0 : 1,
            }}
          />
          <span
            className="block h-px w-full transition-all duration-200"
            style={{
              background: 'var(--nav-icon)',
              transform: menuOpen ? 'translateY(-6px) rotate(-45deg)' : 'none',
            }}
          />
        </button>

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div
            className="w-2 h-2 transition-shadow"
            style={{
              background: 'var(--nav-icon)',
            }}
          />
          <span className="tracking-widest uppercase text-[10px]">
            <GlitchText
              active={true}
              text="CNSS"
              duration={400}
              style={{ color: 'var(--ow-text-mid)' }}
            />
            <GlitchText
              active={true}
              text="_2026"
              duration={400}
              className="ml-0.5"
              style={{ color: 'var(--accent)' }}
            />
          </span>
        </Link>

        {/* 桌面端导航链接 */}
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item, i) => (
            <Link
              key={item.href}
              href={item.href}
              className="px-3 py-1 border border-transparent
                         uppercase tracking-widest text-[10px]
                         transition-colors duration-150"
              style={{ color: 'var(--nav-text-dim)' }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLAnchorElement).style.color = 'var(--nav-text-hover)';
                (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--ow-border-dim)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLAnchorElement).style.color = 'var(--nav-text-dim)';
                (e.currentTarget as HTMLAnchorElement).style.borderColor = 'transparent';
              }}
            >
              <GlitchText
                active={true}
                text={item.label}
                duration={350 + i * 80}
                frameInterval={35}
              />
            </Link>
          ))}
        </nav>
      </div>

      {/* 右：状态 */}
      <div className="flex items-center gap-4">
        <div className="hidden md:flex items-center gap-4">
          {/* 总用户数 */}
          <div className="flex items-center gap-1.5">
            <GlitchText
              active={true}
              text="CONTESTANTS:"
              duration={500}
              className="tracking-widest uppercase text-[9px]"
              style={{ color: 'var(--nav-contestants-dim)' }}
            />
            <GlitchText
              active={true}
              text={memberCount != null ? String(memberCount) : '---'}
              duration={600}
              className="tracking-widest text-[9px]"
              style={{ color: 'var(--nav-contestants-val)' }}
            />
          </div>
          {/* 分隔线 */}
          <div className="w-px h-3.5" style={{ background: 'var(--ow-border)' }} />
          {/* 招募状态 */}
          <div className="flex items-center gap-1.5">
            <motion.div
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ background: 'var(--danger)' }}
              animate={{
                boxShadow: [
                  '0 0 3px rgba(225,46,56,0.4)',
                  '0 0 8px rgba(225,46,56,0.9)',
                  '0 0 3px rgba(225,46,56,0.4)',
                ],
                scale: [1, 1.25, 1],
              }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            />
            <GlitchText
              active={true}
              text="RECRUITMENT IN PROGRESS"
              duration={650}
              className="tracking-widest uppercase text-[9px]"
              style={{ color: 'var(--danger)' }}
            />
          </div>
        </div>

        {isAuthenticated ? (
          <div className="flex items-center gap-3">
            {/* 桌面端用户名 + 下拉菜单 */}
            <div className="relative hidden md:block">
              <button
                onClick={() => setUserMenuOpen(v => !v)}
                className="flex items-center gap-2 px-2 py-1 border border-transparent
                           transition-colors duration-150"
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--ow-border-dim)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'transparent')}
              >
                <GlitchText
                  active={true}
                  text="User:"
                  duration={300}
                  className="text-[9px] uppercase tracking-widest"
                  style={{ color: 'var(--nav-text-dim)' }}
                />
                <GlitchText
                  active={true}
                  text={user?.username ?? ''}
                  duration={500}
                  className="tracking-wider"
                  style={{ color: 'var(--ow-text-mid)' }}
                />
                <svg
                  width="8" height="8" viewBox="0 0 8 8"
                  className="shrink-0 transition-transform duration-200"
                  style={{
                    transform: userMenuOpen ? 'rotate(45deg)' : 'none',
                    opacity: 0.4,
                    color: 'var(--ow-text)',
                  }}
                >
                  <line x1="4" y1="0" x2="4" y2="8" stroke="currentColor" strokeWidth="1" />
                  <line x1="0" y1="4" x2="8" y2="4" stroke="currentColor" strokeWidth="1" />
                </svg>
              </button>

              <AnimatePresence>
                {userMenuOpen && (
                  <motion.div
                    key="user-dropdown"
                    className="absolute right-0 top-full mt-px flex flex-col z-50 overflow-hidden"
                    style={{
                      background: 'var(--nav-dropdown-bg)',
                      border: '1px solid var(--nav-dropdown-border)',
                      minWidth: '10rem',
                    }}
                    initial={false}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.12, ease: 'easeOut' }}
                  >
                    {/* 顶部高亮条 */}
                    <div className="h-px w-full" style={{ background: 'var(--accent)', opacity: 0.5 }} />
                    {/* RESET PASSWORD */}
                    <button
                      onClick={() => { setUserMenuOpen(false); router.push('/reset-password'); }}
                      className="px-4 py-2.5 border-b text-left uppercase tracking-widest text-[10px]
                                 transition-colors duration-150 flex items-center gap-2"
                      style={{ borderColor: 'var(--nav-item-border)', color: 'var(--nav-text-dim)' }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'var(--nav-text-hover)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--nav-text-dim)')}
                    >
                      <span className="w-1 h-1 shrink-0" style={{ background: 'var(--accent)' }} />
                      <GlitchText active={userMenuReady} text="RESET PASSWORD" duration={250} frameInterval={30} />
                    </button>
                    {/* ENTER NSCC */}
                    <button
                      onClick={() => { setUserMenuOpen(false); handleNsccLogin(); }}
                      className="px-4 py-2.5 border-b text-left uppercase tracking-widest text-[10px]
                                 transition-colors duration-150 flex items-center gap-2"
                      style={{ borderColor: 'var(--nav-item-border)', color: 'var(--nav-text-dim)' }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'var(--nav-text-hover)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--nav-text-dim)')}
                    >
                      <span className="w-1 h-1 shrink-0" style={{ background: 'var(--accent)' }} />
                      <GlitchText active={userMenuReady} text="ENTER NSCC" duration={250} frameInterval={30} />
                    </button>
                    {/* LOGOUT */}
                    <button
                      onClick={() => { setUserMenuOpen(false); handleLogout(); }}
                      className="px-4 py-2.5 text-left uppercase tracking-widest text-[10px]
                                 transition-colors duration-150 flex items-center gap-2"
                      style={{ color: 'var(--nav-text-dim)' }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'var(--nav-text-hover)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--nav-text-dim)')}
                    >
                      <span className="w-1 h-1 shrink-0" style={{ background: 'var(--ow-text-muted)' }} />
                      <GlitchText active={userMenuReady} text="LOGOUT" duration={250} frameInterval={30} />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* 移动端：仅显示用户名 */}
            <div className="flex items-center gap-2 md:hidden">
              <GlitchText
                active={true}
                text="User:"
                duration={300}
                className="text-[9px] uppercase tracking-widest"
                style={{ color: 'var(--nav-text-dim)' }}
              />
              <GlitchText
                active={true}
                text={user?.username ?? ''}
                duration={500}
                className="tracking-wider"
                style={{ color: 'var(--ow-text-mid)' }}
              />
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link
              href="/register"
              className="px-3 py-1 border bg-transparent
                         uppercase tracking-widest text-[10px]
                         transition-colors duration-150"
              style={{ borderColor: 'var(--ow-border)', color: 'var(--nav-text-dim)' }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--ow-border-dim)';
                (e.currentTarget as HTMLAnchorElement).style.color = 'var(--nav-text-hover)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--ow-border)';
                (e.currentTarget as HTMLAnchorElement).style.color = 'var(--nav-text-dim)';
              }}
            >
              <GlitchText active={true} text="REGISTER" duration={400} />
            </Link>
            <Link
              href="/login"
              className="px-3 py-1 border
                         uppercase tracking-widest text-[10px]
                         transition-colors duration-150"
              style={{
                borderColor: 'var(--ow-border-dim)',
                background: 'var(--ow-panel)',
                color: 'var(--ow-text-mid)',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLAnchorElement).style.background = 'var(--ow-panel-bg-alt)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLAnchorElement).style.background = 'var(--ow-panel)';
              }}
            >
              <GlitchText active={true} text="LOGIN" duration={400} />
            </Link>
          </div>
        )}
      </div>

      {/* 移动端下拉菜单 */}
      <AnimatePresence>
        {menuOpen && (
          <motion.nav
            key="mobile-nav"
            className="absolute top-12 left-0 right-0 z-50 flex flex-col md:hidden border-b"
            style={{
              background: 'var(--nav-mobile-bg)',
              borderColor: 'var(--ow-border)',
            }}
            initial={false}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
          >
            {navItems.map((item, i) => (
              <Link
                key={item.href}
                href={item.href}
                className="px-6 py-4 border-b ow-mono text-[12px] uppercase tracking-widest
                           transition-colors duration-150"
                style={{ borderColor: 'var(--nav-item-border)', color: 'var(--nav-text-dim)' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--nav-text-hover)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--nav-text-dim)')}
              >
                <GlitchText
                  active={menuReady}
                  text={item.label}
                  duration={300 + i * 60}
                  frameInterval={35}
                />
              </Link>
            ))}
            {/* 登录后追加：NSCC + LOGOUT */}
            {isAuthenticated && (
              <>
                <button
                  onClick={() => { setMenuOpen(false); handleNsccLogin(); }}
                  className="px-6 py-4 border-b ow-mono text-[12px] uppercase tracking-widest
                             text-left transition-colors duration-150"
                  style={{ borderColor: 'var(--nav-item-border)', color: 'var(--nav-text-dim)' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--nav-text-hover)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--nav-text-dim)')}
                >
                  <GlitchText
                    active={menuReady}
                    text="NSCC"
                    duration={300 + navItems.length * 60}
                    frameInterval={35}
                  />
                </button>
                <button
                  onClick={() => { setMenuOpen(false); handleLogout(); }}
                  className="px-6 py-4 border-b ow-mono text-[12px] uppercase tracking-widest
                             text-left transition-colors duration-150"
                  style={{ borderColor: 'var(--nav-item-border)', color: 'var(--nav-text-dim)' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--nav-text-hover)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--nav-text-dim)')}
                >
                  <GlitchText
                    active={menuReady}
                    text="LOGOUT"
                    duration={300 + (navItems.length + 1) * 60}
                    frameInterval={35}
                  />
                </button>
              </>
            )}
          </motion.nav>
        )}
      </AnimatePresence>
    </motion.header>
  );
}

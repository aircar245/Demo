'use client';

import { isValidPassword, PASSWORD_HINT } from '@/lib/password';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { sendVerifyEmail, changePassword } from '@/lib/api/auth';

const ERR_MAP: Record<string, string> = {
  'Email code is incorrect':  '邮箱验证码错误或已过期',
  'Rate limit exceeded':      '验证码发送过于频繁，请稍后再试',
  'Invalid email format':     '邮箱格式不正确',
  'User not found':           '该邮箱未注册',
};

function localizeError(raw: string): string {
  for (const [key, val] of Object.entries(ERR_MAP)) {
    if (raw.includes(key)) return val;
  }
  return raw;
}

export default function ResetPasswordPage() {
  const router = useRouter();

  const [email,       setEmail]       = useState('');
  const [emailCode,   setEmailCode]   = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [done,        setDone]        = useState(false);
  const [codeSending, setCodeSending] = useState(false);
  const [codeTimer,   setCodeTimer]   = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  function startTimer() {
    setCodeTimer(60);
    timerRef.current = setInterval(() => {
      setCodeTimer(t => {
        if (t <= 1) { clearInterval(timerRef.current!); timerRef.current = null; return 0; }
        return t - 1;
      });
    }, 1000);
  }

  const handleSendCode = useCallback(async () => {
    if (!email) { setError('请先填写邮箱'); return; }
    setCodeSending(true); setError(null);
    try {
      await sendVerifyEmail(email);
      startTimer();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message ?? '发送失败';
      setError(localizeError(typeof msg === 'string' ? msg : '发送失败'));
    } finally {
      setCodeSending(false);
    }
  }, [email]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !emailCode || !newPassword) { setError('请填写所有字段'); return; }
    if (!isValidPassword(newPassword)) { setError(PASSWORD_HINT); return; }
    setLoading(true); setError(null);
    try {
      await changePassword(email, emailCode, newPassword);
      setDone(true);
      setTimeout(() => router.push('/login'), 2000);
    } catch (err: unknown) {
      const raw = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message ?? '重置失败，请稍后重试';
      setError(localizeError(typeof raw === 'string' ? raw : '重置失败'));
    } finally {
      setLoading(false);
    }
  }

  const inp     = "flex-1 bg-transparent outline-none ow-mono text-sm";
  const inpWrap = "flex items-center gap-2 border px-3 py-2.5";
  const inpStyle = { borderColor: 'var(--ow-border)', background: 'var(--ow-panel)' };
  const label   = "ow-mono text-[9px] tracking-widest uppercase";

  return (
    <div
      className="min-h-[calc(100dvh-3rem)] flex items-center justify-center px-4 py-8"
      style={{ background: 'var(--ow-bg)' }}
    >
      <div className="absolute inset-0 ow-dots pointer-events-none opacity-40" />

      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
        className="relative z-10 w-full max-w-md border"
        style={{ borderColor: 'var(--ow-border)', background: 'var(--ow-panel-bg-main)' }}
      >
        <span className="ow-corner ow-corner-tl" />
        <span className="ow-corner ow-corner-tr" />
        <span className="ow-corner ow-corner-bl" />
        <span className="ow-corner ow-corner-br" />

        <div className="p-8 flex flex-col gap-5">

          {/* 标题区 */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2" style={{ background: '#58A6FF' }} />
              <span className="ow-mono text-[9px] tracking-widest uppercase" style={{ color: 'var(--ow-text-muted)' }}>
                CNSS_2026 / AUTH / RESET_PASSWORD
              </span>
            </div>
            <h1 className="font-['Inter'] text-3xl font-light tracking-tight" style={{ color: 'var(--ow-text)' }}>
              RESET PASSWORD
            </h1>
            <p className="ow-mono text-[10px] tracking-widest uppercase" style={{ color: 'var(--ow-text-muted)' }}>
              通过邮箱验证码重置密码
              <span className="inline-block w-[6px] h-[10px] ml-1 align-middle animate-ow-blink" style={{ background: 'var(--ow-text-muted)' }} />
            </p>
          </div>

          <div className="border-t" style={{ borderColor: 'var(--ow-border)' }} />

          {done ? (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="ow-mono text-[11px] px-3 py-3 border text-center"
              style={{ color: '#3FB950', borderColor: '#3FB950', background: 'rgba(63,185,80,0.06)' }}
            >
              密码重置成功，即将跳转到登录页...
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">

              {/* EMAIL */}
              <div className="flex flex-col gap-1.5">
                <label className={label} style={{ color: 'var(--ow-text-muted)' }}>EMAIL</label>
                <div className={inpWrap} style={inpStyle}>
                  <span className="ow-mono text-sm" style={{ color: 'var(--ow-text-muted)' }}>&gt;</span>
                  <input type="email" placeholder="your@email.com"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setError(null); }}
                    className={inp} style={{ color: 'var(--ow-text)' }} />
                </div>
              </div>

              {/* EMAIL CODE */}
              <div className="flex flex-col gap-1.5">
                <label className={label} style={{ color: 'var(--ow-text-muted)' }}>EMAIL_CODE</label>
                <div className="flex gap-2">
                  <div className={`${inpWrap} flex-1`} style={inpStyle}>
                    <span className="ow-mono text-sm" style={{ color: 'var(--ow-text-muted)' }}>&gt;</span>
                    <input type="text" placeholder="6 位验证码" maxLength={6}
                      value={emailCode}
                      onChange={e => setEmailCode(e.target.value)}
                      className={inp} style={{ color: 'var(--ow-text)' }} />
                  </div>
                  <button
                    type="button"
                    disabled={codeSending || codeTimer > 0}
                    onClick={handleSendCode}
                    className="px-3 py-2.5 border ow-mono text-[10px] uppercase tracking-widest transition-colors shrink-0 disabled:opacity-40"
                    style={{ borderColor: 'var(--ow-border)', color: codeTimer > 0 ? '#555' : '#8A8A8A' }}
                  >
                    {codeSending ? '...' : codeTimer > 0 ? `${codeTimer}s` : '发送'}
                  </button>
                </div>
              </div>

              {/* NEW PASSWORD */}
              <div className="flex flex-col gap-1.5">
                <label className={label} style={{ color: 'var(--ow-text-muted)' }}>NEW_PASSWORD</label>
                <div className={inpWrap} style={inpStyle}>
                  <span className="ow-mono text-sm" style={{ color: 'var(--ow-text-muted)' }}>&gt;</span>
                  <input type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="8–64 位，大小写字母、数字、符号至少三类" title={PASSWORD_HINT}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className={inp} style={{ color: 'var(--ow-text)' }} />
                  <button type="button" onClick={() => setShowPassword(v => !v)}
                    className="ow-mono text-[9px] uppercase tracking-widest shrink-0 transition-colors"
                    style={{ color: showPassword ? '#8A8A8A' : '#555' }}>
                    {showPassword ? '[隐藏]' : '[显示]'}
                  </button>
                </div>
              </div>

              {/* 错误提示 */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="ow-mono text-[11px] px-3 py-2 border"
                  style={{ color: '#E12E38', borderColor: '#E12E38', background: 'rgba(225,46,56,0.06)' }}
                >
                  ERR: {error}
                </motion.div>
              )}

              {/* 提交 */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 border ow-mono text-[11px] uppercase tracking-widest transition-colors duration-150 mt-1 disabled:opacity-40"
                style={{
                  borderColor: loading ? '#3A3A3A' : '#8A8A8A',
                  color:       loading ? '#555'    : '#F5F5F5',
                  background:  loading ? 'transparent' : 'rgba(255,255,255,0.03)',
                }}
              >
                {loading ? '> RESETTING...' : '[ EXECUTE RESET ]'}
              </button>
            </form>
          )}

          <div className="border-t" style={{ borderColor: 'var(--ow-border)' }} />

          {/* 底部：跳转登录 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#58A6FF', boxShadow: '0 0 6px rgba(88,166,255,0.5)' }} />
              <span className="ow-mono text-[9px] tracking-widest uppercase" style={{ color: 'var(--ow-text-muted)' }}>
                CNSS_2026 / AUTH / SECURE
              </span>
            </div>
            <Link href="/login"
              className="ow-mono text-[10px] uppercase tracking-widest transition-colors"
              style={{ color: 'var(--ow-text-muted)' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#8A8A8A')}
              onMouseLeave={e => (e.currentTarget.style.color = '#555')}
            >
              想起密码了 → [ LOGIN ]
            </Link>
          </div>

        </div>
      </motion.div>
    </div>
  );
}

'use client';

import { isValidPassword, PASSWORD_HINT } from '@/lib/password';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { register, sendVerifyEmail } from '@/lib/api/auth';
import { containsUnsafeDisplayCharacters } from '@/lib/safeText';
import { useAuthStore } from '@/store/authStore';

/** 后端英文错误 → 中文提示 */
const ERR_MAP: Record<string, string> = {
  'QQ ID already exists': '该 QQ 号已被注册',
  'NotInGroup': '请先加入指定 QQ 群后再注册',
  'QQ verify failed': 'QQ 群验证服务暂不可用，请稍后重试',
  'NAPCAT_BASE_URL is not configured': 'QQ 群验证服务尚未配置，请联系管理员',
  'QQ_VERIFY_GROUP_ID is not configured': 'QQ 群验证服务尚未配置，请联系管理员',
  'Email already exists':       '该邮箱已被注册',
  'Username already exists':    '用户名已被占用',
  'Email code is incorrect':    '邮箱验证码错误或已过期',
  'Invitation code is required': '校外用户必须填写邀请码',
  'Invitation code is incorrect':'邀请码无效',
  'Rate limit exceeded':        '验证码发送过于频繁，请稍后再试',
  'Invalid email format':       '邮箱格式不正确',
};

function localizeError(raw: string): string {
  for (const [key, val] of Object.entries(ERR_MAP)) {
    if (raw.includes(key)) return val;
  }
  return raw;
}

type Mode = 'internal' | 'external';

export default function RegisterPage() {
  const router = useRouter();
  const setUserFromLogin = useAuthStore((s) => s.setUserFromLogin);

  const [mode, setMode] = useState<Mode>('internal');
  const [form, setForm] = useState({
    username: '',
    emailPrefix: '',   // 校内：前缀部分
    emailFull: '',     // 校外：完整邮箱
    emailCode: '',
    password: '',
    telephone: '',
    qqId: '',
    invitation: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [codeSending, setCodeSending] = useState(false);
  const [codeTimer, setCodeTimer] = useState(0);       // 0 = 可发送
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 切换模式时清空错误和模式相关字段
  const switchMode = useCallback((m: Mode) => {
    setMode(m);
    setError(null);
    setForm(f => ({ ...f, emailPrefix: '', emailFull: '', emailCode: '', invitation: '' }));
    setCodeTimer(0);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  // 60秒倒计时
  function startTimer() {
    setCodeTimer(60);
    timerRef.current = setInterval(() => {
      setCodeTimer(t => {
        if (t <= 1) { clearInterval(timerRef.current!); timerRef.current = null; return 0; }
        return t - 1;
      });
    }, 1000);
  }

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const currentEmail = mode === 'internal'
    ? `${form.emailPrefix}@std.uestc.edu.cn`
    : form.emailFull;

  async function handleSendCode() {
    const email = currentEmail;
    if (!email || (mode === 'internal' && !form.emailPrefix)) {
      setError('请先填写邮箱'); return;
    }
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
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    // 基础校验
    if (!form.username || !form.password || !form.telephone || !form.qqId || !form.emailCode) {
      setError('请填写所有必填字段'); return;
    }
    if (!/^[1-9]\d{4,11}$/.test(form.qqId)) { setError('QQ 号须为 5–12 位数字，且首位不能为 0'); return; }
    if (containsUnsafeDisplayCharacters(form.username)) {
      setError('用户名不能包含控制字符或不可见格式字符'); return;
    }
    if (mode === 'internal' && !form.emailPrefix) { setError('请填写邮箱前缀'); return; }
    if (mode === 'external' && !form.emailFull)   { setError('请填写邮箱'); return; }
    if (mode === 'external' && !form.invitation)  { setError('校外用户必须填写邀请码'); return; }

    if (!isValidPassword(form.password)) { setError(PASSWORD_HINT); return; }
    setLoading(true);
    try {
      const data = await register({
        username:   form.username.normalize('NFC'),
        email:      currentEmail,
        password:   form.password,
        telephone:  form.telephone,
        qqId:       form.qqId,
        emailCode:  form.emailCode,
        invitation: form.invitation,
      });
      setUserFromLogin(data);
      router.push('/challenges');
    } catch (err: unknown) {
      const raw = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message ?? '注册失败，请稍后重试';
      setError(localizeError(Array.isArray(raw) ? raw.join('；') : typeof raw === 'string' ? raw : '注册失败'));
    } finally {
      setLoading(false);
    }
  }

  const inp = "flex-1 bg-transparent outline-none ow-mono text-sm";
  const inpWrap = "flex items-center gap-2 border px-3 py-2.5";
  const inpStyle = { borderColor: 'var(--ow-border)', background: 'var(--ow-panel)' };
  const label = "ow-mono text-[9px] tracking-widest uppercase";

  return (
    <div
      className="min-h-[calc(100dvh-3rem)] flex items-center justify-center px-4 py-8"
      style={{ background: 'var(--ow-bg)' }}
    >
      <div className="absolute inset-0 ow-dots pointer-events-none opacity-40" />

      <motion.div
        initial={false}
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
              <div className="w-2 h-2" style={{ background: '#3FB950' }} />
              <span className="ow-mono text-[9px] tracking-widest uppercase" style={{ color: 'var(--ow-text-muted)' }}>
                CNSS_2026 / AUTH / REGISTER
              </span>
            </div>
            <h1 className="font-['Inter'] text-3xl font-light tracking-tight" style={{ color: 'var(--ow-text)' }}>
              REGISTER
            </h1>
            <p className="ow-mono text-[10px] tracking-widest uppercase" style={{ color: 'var(--ow-text-muted)' }}>
              创建你的 CNSS 账号
              <span className="inline-block w-[6px] h-[10px] ml-1 align-middle animate-ow-blink" style={{ background: 'var(--ow-text-muted)' }} />
            </p>
          </div>

          <div className="border-t" style={{ borderColor: 'var(--ow-border)' }} />

          {/* 模式切换 */}
          <div className="flex gap-0 border" style={{ borderColor: 'var(--ow-border)' }}>
            {(['internal', 'external'] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                className="flex-1 py-2 ow-mono text-[10px] uppercase tracking-widest transition-colors duration-150"
                style={{
                  background: mode === m ? 'rgba(63,185,80,0.08)' : 'transparent',
                  color:       mode === m ? '#3FB950' : '#555',
                  borderRight: m === 'internal' ? '1px solid #2A2A2A' : undefined,
                }}
              >
                {m === 'internal' ? '[ UESTC 校内 ]' : '[ EXTERNAL 校外 ]'}
              </button>
            ))}
          </div>

          {/* 表单 */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">

            {/* USERNAME */}
            <div className="flex flex-col gap-1.5">
              <label className={label} style={{ color: 'var(--ow-text-muted)' }}>USERNAME</label>
              <div className={inpWrap} style={inpStyle}>
                <span className="ow-mono text-sm" style={{ color: 'var(--ow-text-muted)' }}>&gt;</span>
                <input type="text" autoComplete="username" placeholder="4–20 字符"
                  value={form.username}
                  onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                  className={inp} style={{ color: 'var(--ow-text)' }} />
              </div>
            </div>

            {/* EMAIL */}
            <div className="flex flex-col gap-1.5">
              <label className={label} style={{ color: 'var(--ow-text-muted)' }}>EMAIL</label>
              {mode === 'internal' ? (
                <div className={inpWrap} style={inpStyle}>
                  <span className="ow-mono text-sm" style={{ color: 'var(--ow-text-muted)' }}>&gt;</span>
                  <input type="text" placeholder="学号或邮箱前缀"
                    value={form.emailPrefix}
                    onChange={e => setForm(f => ({ ...f, emailPrefix: e.target.value }))}
                    className={inp} style={{ color: 'var(--ow-text)' }} />
                  <span className="ow-mono text-[11px] shrink-0" style={{ color: 'var(--ow-text-muted)' }}>
                    @std.uestc.edu.cn
                  </span>
                </div>
              ) : (
                <div className={inpWrap} style={inpStyle}>
                  <span className="ow-mono text-sm" style={{ color: 'var(--ow-text-muted)' }}>&gt;</span>
                  <input type="email" placeholder="your@email.com"
                    value={form.emailFull}
                    onChange={e => setForm(f => ({ ...f, emailFull: e.target.value }))}
                    className={inp} style={{ color: 'var(--ow-text)' }} />
                </div>
              )}
            </div>

            {/* EMAIL CODE */}
            <div className="flex flex-col gap-1.5">
              <label className={label} style={{ color: 'var(--ow-text-muted)' }}>EMAIL_CODE</label>
              <div className="flex gap-2">
                <div className={`${inpWrap} flex-1`} style={inpStyle}>
                  <span className="ow-mono text-sm" style={{ color: 'var(--ow-text-muted)' }}>&gt;</span>
                  <input type="text" placeholder="6 位验证码" maxLength={6}
                    value={form.emailCode}
                    onChange={e => setForm(f => ({ ...f, emailCode: e.target.value }))}
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

            {/* PASSWORD */}
            <div className="flex flex-col gap-1.5">
              <label className={label} style={{ color: 'var(--ow-text-muted)' }}>PASSWORD</label>
              <div className={inpWrap} style={inpStyle}>
                <span className="ow-mono text-sm" style={{ color: 'var(--ow-text-muted)' }}>&gt;</span>
                <input type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="8–64 位，大小写字母、数字、符号至少三类" title={PASSWORD_HINT}
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  className={inp} style={{ color: 'var(--ow-text)' }} />
                <button type="button" onClick={() => setShowPassword(v => !v)}
                  className="ow-mono text-[9px] uppercase tracking-widest shrink-0 transition-colors"
                  style={{ color: showPassword ? '#8A8A8A' : '#555' }}>
                  {showPassword ? '[隐藏]' : '[显示]'}
                </button>
              </div>
            </div>

            {/* TELEPHONE */}
            <div className="flex flex-col gap-1.5">
              <label className={label} style={{ color: 'var(--ow-text-muted)' }}>TELEPHONE</label>
              <div className={inpWrap} style={inpStyle}>
                <span className="ow-mono text-sm" style={{ color: 'var(--ow-text-muted)' }}>&gt;</span>
                <input type="tel" placeholder="11 位手机号" maxLength={11}
                  value={form.telephone}
                  onChange={e => setForm(f => ({ ...f, telephone: e.target.value }))}
                  className={inp} style={{ color: 'var(--ow-text)' }} />
              </div>
            </div>

            {/* QQ_ID */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className={label} style={{ color: 'var(--ow-text-muted)' }}>QQ_ID</label>
                <span className="ow-mono text-[9px]" style={{ color: 'var(--ow-text-muted)' }}>
                  ⚠ 请确保已加入 CNSS 招新 QQ 群
                </span>
              </div>
              <div className={inpWrap} style={inpStyle}>
                <span className="ow-mono text-sm" style={{ color: 'var(--ow-text-muted)' }}>&gt;</span>
                <input type="text" placeholder="你的 QQ 号"
                  value={form.qqId}
                  onChange={e => setForm(f => ({ ...f, qqId: e.target.value }))}
                  className={inp} style={{ color: 'var(--ow-text)' }} />
              </div>
            </div>

            {/* INVITE_CODE（仅校外） */}
            {mode === 'external' && (
              <motion.div
                initial={false}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col gap-1.5 overflow-hidden"
              >
                <label className={label} style={{ color: 'var(--ow-text-muted)' }}>INVITE_CODE</label>
                <div className={inpWrap} style={inpStyle}>
                  <span className="ow-mono text-sm" style={{ color: 'var(--ow-text-muted)' }}>&gt;</span>
                  <input type="text" placeholder="CNSS-XXXXXX"
                    value={form.invitation}
                    onChange={e => setForm(f => ({ ...f, invitation: e.target.value }))}
                    className={inp} style={{ color: 'var(--ow-text)' }} />
                </div>
              </motion.div>
            )}

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
              {loading ? '> REGISTERING...' : '[ EXECUTE REGISTER ]'}
            </button>
          </form>

          <div className="border-t" style={{ borderColor: 'var(--ow-border)' }} />

          {/* 底部：跳转登录 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#3FB950', boxShadow: '0 0 6px rgba(63,185,80,0.5)' }} />
              <span className="ow-mono text-[9px] tracking-widest uppercase" style={{ color: 'var(--ow-text-muted)' }}>
                CNSS_2026 / RECRUIT / OPEN
              </span>
            </div>
            <Link href="/login" className="ow-mono text-[10px] uppercase tracking-widest transition-colors"
              style={{ color: 'var(--ow-text-muted)' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#8A8A8A')}
              onMouseLeave={e => (e.currentTarget.style.color = '#555')}
            >
              已有账号 → [ LOGIN ]
            </Link>
          </div>

        </div>
      </motion.div>
    </div>
  );
}

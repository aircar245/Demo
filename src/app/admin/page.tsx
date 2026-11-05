'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  getUserList, setAdminRole, setBanned, type AdminUser,
  getInviteCodeList, createInviteCode, deleteInviteCode,
  setLeaderboardVisibility,
} from '@/lib/api/admin';
import { PanelReveal } from '@/components/ow/PanelReveal';
import { GlitchText } from '@/components/ow/GlitchText';
import { useAuthStore } from '@/store/authStore';

type Tab = 'users' | 'invitations';

const USER_GROUP_LABEL: Record<number, string> = {
  0: 'ACTIVE',
  1: 'VETERAN',
  2: 'EXTERNAL',
  4: 'OBSERVER',
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }
  return (
    <button
      onClick={handleCopy}
      className="px-2 py-1 border ow-mono text-[9px] uppercase transition-colors text-center"
      style={{
        borderColor: copied ? '#3FB950' : '#2A2A2A',
        color:       copied ? '#3FB950' : '#555',
      }}
    >
      {copied ? '[ COPIED ]' : '[ COPY ]'}
    </button>
  );
}

function LeaderboardVisibilityControl() {
  const [visible, setVisible] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; ok: boolean } | null>(null);

  async function handleToggle() {
    const nextVisible = !visible;
    setUpdating(true);
    setFeedback(null);
    try {
      await setLeaderboardVisibility(nextVisible);
      setVisible(nextVisible);
      setFeedback({
        text: nextVisible ? '排行榜已对普通用户开放' : '排行榜已对普通用户隐藏',
        ok: true,
      });
    } catch {
      setFeedback({ text: '排行榜可见性更新失败', ok: false });
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div className="mt-4 border px-3 py-3 md:px-4" style={{ borderColor: 'var(--ow-border)', background: 'var(--ow-panel)' }}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="ow-mono text-[10px] tracking-widest" style={{ color: 'var(--ow-text)' }}>
              排行榜对普通用户可见
            </span>
            <span
              className="ow-mono text-[9px]"
              style={{ color: visible ? '#3FB950' : 'var(--ow-text-muted)' }}
            >
              {updating ? 'UPDATING...' : visible ? 'VISIBLE' : 'HIDDEN'}
            </span>
          </div>
          <p className="mt-1 text-[10px] leading-relaxed" style={{ color: 'var(--ow-text-muted)' }}>
            后端暂无状态查询接口；首次进入按默认关闭显示。
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-label="排行榜对普通用户可见"
          aria-checked={visible}
          disabled={updating}
          onClick={handleToggle}
          className="relative h-7 w-14 shrink-0 border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-wait disabled:opacity-50"
          style={{
            borderColor: visible ? '#3FB950' : '#555',
            background: visible ? 'rgba(63,185,80,0.12)' : 'rgba(255,255,255,0.02)',
            outlineColor: '#F5D700',
          }}
        >
          <span
            aria-hidden="true"
            className="absolute top-1 h-[18px] w-[18px] transition-[left,background-color]"
            style={{
              left: visible ? '32px' : '4px',
              background: visible ? '#3FB950' : '#666',
            }}
          />
        </button>
      </div>
      <div className="min-h-4 mt-2" role="status" aria-live="polite">
        {feedback && (
          <span className="ow-mono text-[10px]" style={{ color: feedback.ok ? '#3FB950' : '#E12E38' }}>
            {feedback.ok ? '✓ ' : '✗ '}{feedback.text}
          </span>
        )}
      </div>
    </div>
  );
}

function InvitationsPanel({ panelReady }: { panelReady: boolean }) {
  const queryClient = useQueryClient();
  const [comment, setComment] = useState('');
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const { data: codes = [], isLoading } = useQuery({
    queryKey: ['admin-invite-codes'],
    queryFn: getInviteCodeList,
  });

  async function handleCreate() {
    if (!comment.trim()) { setMsg({ text: '请填写备注（用于标识此邀请码用途）', ok: false }); return; }
    setCreating(true); setMsg(null);
    try {
      await createInviteCode(comment.trim());
      queryClient.invalidateQueries({ queryKey: ['admin-invite-codes'] });
      setComment('');
      setMsg({ text: '邀请码已生成', ok: true });
    } catch {
      setMsg({ text: '生成失败', ok: false });
    } finally { setCreating(false); }
  }

  async function handleDelete(id: number, content: string) {
    setDeletingId(id); setMsg(null);
    try {
      await deleteInviteCode(id);
      queryClient.invalidateQueries({ queryKey: ['admin-invite-codes'] });
      setMsg({ text: `已删除 ${content}`, ok: true });
    } catch {
      setMsg({ text: '删除失败', ok: false });
    } finally { setDeletingId(null); }
  }

  return (
    <div className="flex flex-col h-full">
      {/* 创建区 */}
      <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--ow-border)' }}>
        <div className="flex items-center gap-2 mb-3">
          <GlitchText active={panelReady} text="GENERATE INVITE CODE" tag="span"
            className="ow-mono text-[10px] uppercase tracking-widest"
            style={{ color: 'var(--ow-text-dim)' }} duration={400} />
        </div>
        <div className="flex gap-2">
          <div className="flex items-center gap-2 border px-3 py-2 flex-1"
            style={{ borderColor: 'var(--ow-border)', background: 'var(--ow-panel)' }}>
            <span className="ow-mono text-sm" style={{ color: 'var(--ow-text-muted)' }}>&gt;</span>
            <input
              type="text"
              value={comment}
              onChange={e => setComment(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              placeholder="COMMENT"
              className="flex-1 bg-transparent outline-none ow-mono text-[11px]"
              style={{ color: 'var(--ow-text)' }}
            />
          </div>
          <button
            disabled={creating}
            onClick={handleCreate}
            className="px-4 py-2 border ow-mono text-[10px] uppercase tracking-widest transition-colors disabled:opacity-40"
            style={{ borderColor: '#3FB950', color: '#3FB950', background: 'rgba(63,185,80,0.04)' }}
          >
            {creating ? '...' : '[ + CREATE ]'}
          </button>
        </div>
        {msg && (
          <div className="mt-2 px-3 py-1.5 border ow-mono text-[10px]"
            style={{
              borderColor: msg.ok ? '#3FB950' : '#E12E38',
              color:       msg.ok ? '#3FB950' : '#E12E38',
              background:  msg.ok ? 'rgba(63,185,80,0.04)' : 'rgba(225,46,56,0.04)',
            }}>
            {msg.ok ? '✓ ' : '✗ '}{msg.text}
          </div>
        )}
      </div>

      {/* 表头 + 邀请码列表：同一 overflow-x-auto 容器 */}
      <div className="flex-1 overflow-x-auto overflow-y-auto min-h-0">
      <div className="grid gap-x-3 px-5 py-2 border-b sticky top-0"
        style={{
          gridTemplateColumns: '3rem 1fr 1fr 5rem 6rem',
          borderColor: 'var(--ow-border)',
          background: 'var(--ow-panel-bg-main)',
          minWidth: '32rem',
        }}>
        {['ID', 'CODE', 'COMMENT', 'COPY', 'ACTION'].map((h, i) => (
          <div key={i} className="ow-mono text-[9px] uppercase tracking-widest" style={{ color: 'var(--ow-text-muted)' }}>{h}</div>
        ))}
      </div>

      <div>
        {isLoading ? (
          <div className="flex items-center justify-center h-24">
            <span className="ow-mono text-[11px] uppercase tracking-widest" style={{ color: 'var(--ow-text-muted)' }}>
              &gt; Loading codes...
            </span>
          </div>
        ) : codes.length === 0 ? (
          <div className="flex items-center justify-center h-24">
            <span className="ow-mono text-[11px]" style={{ color: 'var(--ow-text-muted)' }}>NO INVITE CODES</span>
          </div>
        ) : (
          codes.map((c, i) => (
            <motion.div
              key={c.id}
              initial={false}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2, delay: i * 0.04, ease: 'easeOut' }}
              className="grid items-center gap-x-3 px-5 py-2.5 border-b transition-colors"
              style={{
                gridTemplateColumns: '3rem 1fr 1fr 5rem 6rem',
                borderBottomColor: '#1A1A1A',
                minWidth: '32rem',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.015)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <span className="ow-mono text-[10px]" style={{ color: 'var(--ow-text-muted)' }}>{c.id}</span>
              <span className="ow-mono text-[11px] tracking-wider" style={{ color: '#3FB950' }}>{c.content}</span>
              <span className="ow-mono text-[11px] truncate" style={{ color: 'var(--ow-text-dim)' }}>{c.comment || '—'}</span>
              <CopyButton text={c.content} />
              <button
                disabled={deletingId === c.id}
                onClick={() => handleDelete(c.id, c.content)}
                className="px-2 py-1 border ow-mono text-[9px] uppercase transition-colors disabled:opacity-40 text-center"
                style={{ borderColor: '#E12E38', color: '#E12E38' }}
              >
                {deletingId === c.id ? '...' : '[ DELETE ]'}
              </button>
            </motion.div>
          ))
        )}
      </div>
      </div>
    </div>
  );
}

function UserRow({
  u, onToggleAdmin, onToggleBan, loading, index, currentUser,
}: {
  u: AdminUser;
  currentUser: { userId: number; role: 0 | 1 | 2 };
  onToggleAdmin: (userId: number, role: 0 | 1) => void;
  onToggleBan:   (userId: number, value: boolean) => void;
  loading: boolean;
  index: number;
}) {
  return (
    <motion.div
      initial={false}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, delay: index * 0.03, ease: 'easeOut' }}
      className="grid items-center gap-x-3 px-5 py-2.5 border-b transition-colors"
      style={{
        gridTemplateColumns: '2.5rem minmax(10rem, 1fr) 6rem 7rem 4.5rem 8rem 6rem',
        borderBottomColor: '#1A1A1A',
        minWidth: '52rem',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.015)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <span className="ow-mono text-[10px]" style={{ color: 'var(--ow-text-muted)' }}>{u.userId}</span>
      <span className="ow-mono text-[12px] truncate min-w-0" style={{ color: (u.role > 0) ? '#F5D700' : '#BFBFBF' }}>
        <bdi dir="auto">{u.username}</bdi>
        {(u.role > 0) && (
          <span className="ml-2 text-[9px] px-1 py-0.5 border" style={{ borderColor: '#F5D700', color: '#F5D700' }}>
            {u.role === 2 ? 'SUPER ADMIN' : 'ADMIN'}
          </span>
        )}
      </span>
      <span className="ow-mono text-[10px]" style={{ color: 'var(--ow-text-muted)' }}>
        {USER_GROUP_LABEL[u.userGroup] ?? `GRP_${u.userGroup}`}
      </span>
      <span className="ow-mono text-[10px] truncate" style={{ color: 'var(--ow-text-muted)' }}>{u.qqId || '—'}</span>
      <span className="ow-mono text-[10px]" style={{ color: u.isBanned ? '#E12E38' : '#3FB950' }}>
        {u.isBanned ? 'BANNED' : 'ACTIVE'}
      </span>
      {currentUser.role === 2 && u.role !== 2 ? <button
        disabled={loading}
        onClick={() => onToggleAdmin(u.userId, u.role === 1 ? 0 : 1)}
        className="px-2 py-1 border ow-mono text-[9px] uppercase transition-colors disabled:opacity-40 text-center"
        style={{ borderColor: (u.role > 0) ? '#E12E38' : '#F5D700', color: (u.role > 0) ? '#E12E38' : '#F5D700' }}
      >
        {(u.role > 0) ? '[ REVOKE ADMIN ]' : '[ SET ADMIN ]'}
      </button> : <span />}
      <button
        disabled={loading || currentUser.userId === u.userId || u.role >= currentUser.role}
        onClick={() => onToggleBan(u.userId, !u.isBanned)}
        className="px-2 py-1 border ow-mono text-[9px] uppercase transition-colors disabled:opacity-40 text-center"
        style={{ borderColor: u.isBanned ? '#3FB950' : '#E12E38', color: u.isBanned ? '#3FB950' : '#E12E38' }}
      >
        {u.isBanned ? '[ UNBAN ]' : '[ BAN ]'}
      </button>
    </motion.div>
  );
}

export default function AdminPage() {
  const { user }    = useAuthStore();
  const queryClient = useQueryClient();

  const [panelReady, setPanelReady]   = useState(false);
  const [tab, setTab]                 = useState<Tab>('users');
  const [actionMsg, setActionMsg]     = useState<{ text: string; ok: boolean } | null>(null);
  const [loadingUser, setLoadingUser] = useState<number | null>(null);
  const [search, setSearch]           = useState('');

  const onPanelComplete = useCallback(() => setPanelReady(true), []);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: getUserList,
    enabled: ((user?.role ?? 0) > 0),
  });

  const filtered = users
    .filter(u => !search || u.username.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.userId - b.userId);

  async function handleToggleAdmin(userId: number, role: 0 | 1) {
    if (user?.role !== 2 || users.find(u => u.userId === userId)?.role === 2) return;
    setLoadingUser(userId); setActionMsg(null);
    try {
      await setAdminRole(userId, role);
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setActionMsg({ text: `User ${userId}: role → ${role}`, ok: true });
    } catch {
      setActionMsg({ text: 'Failed to update admin role.', ok: false });
    } finally { setLoadingUser(null); }
  }

  async function handleToggleBan(userId: number, value: boolean) {
    const target = users.find(u => u.userId === userId);
    if (!user || !target || userId === user.userId || target.role >= user.role) return;
    setLoadingUser(userId); setActionMsg(null);
    try {
      await setBanned(userId, value);
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setActionMsg({ text: `User ${userId}: banned → ${value}`, ok: true });
    } catch {
      setActionMsg({ text: 'Failed to update ban status.', ok: false });
    } finally { setLoadingUser(null); }
  }

  if (!user || user.role === 0) return <div className="p-8">仅管理员可访问。<Link href="/login">登录</Link></div>;

  return (
    <div className="flex min-h-[calc(100dvh-3rem)] p-3 md:p-4" style={{ background: 'var(--ow-bg)' }}>
      <PanelReveal delay={0} onComplete={onPanelComplete}
        className="relative flex flex-col overflow-hidden flex-1 min-w-0"
        style={{ background: 'var(--ow-panel-bg-main)' }}>
        <div className="flex flex-col h-full">

          {/* 标题栏 */}
          <div className="px-3 md:px-6 py-5 border-b" style={{ borderColor: 'var(--ow-border)' }}>
            {/* 第一行：标题独占，不与按钮同行（避免 GlitchText 动画期间布局跳动） */}
            <GlitchText active={panelReady} text="ADMIN_PANEL" tag="h1"
              className="font-['Inter'] text-3xl font-light leading-none tracking-tight block"
              style={{ color: 'var(--ow-text)' }} duration={600} />
            {/* 第二行：状态 + 按钮，始终在标题下方 */}
            <div className="flex items-center justify-between gap-3 mt-2 flex-wrap">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#F5D700', boxShadow: '0 0 5px rgba(245,215,0,0.5)' }} />
                <span className="ow-mono text-[9px] uppercase tracking-widest" style={{ color: 'var(--ow-text-muted)' }}>
                  {users.length} USERS LOADED
                </span>
              </div>
              <Link href="/challenges/new"
                className="px-4 py-2 border ow-mono text-[10px] uppercase transition-colors whitespace-nowrap"
                style={{ borderColor: '#F5D700', color: '#F5D700', background: 'rgba(245,215,0,0.04)' }}>
                [ + NEW CHALLENGE ]
              </Link>
            </div>
            <LeaderboardVisibilityControl />
          </div>

          <Link href="/admin/achievements" className="ow-mono text-sm border px-4 py-3 m-4" style={{borderColor:'var(--ow-border)',color:'var(--ow-text)'}}>成就管理 / ACHIEVEMENTS →</Link>
          {/* Tab 切换 */}
          <div className="flex border-b" style={{ borderColor: 'var(--ow-border)' }}>
            {(['users', 'invitations'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => { setTab(t); setActionMsg(null); }}
                className="px-6 py-3 ow-mono text-[10px] uppercase tracking-widest transition-colors border-b-2"
                style={{
                  borderBottomColor: tab === t ? '#F5D700' : 'transparent',
                  color: tab === t ? '#F5D700' : '#555',
                  background: 'transparent',
                }}
              >
                {t === 'users' ? 'USERS' : t === 'invitations' ? 'INVITATIONS' : 'ONE-TIME FLAGS'}
              </button>
            ))}
          </div>

          {/* USERS 内容 */}
          {tab === 'users' && (
            <div className="flex flex-col flex-1 min-h-0">
              {/* 操作反馈 */}
              {actionMsg && (
                <div className="mx-3 md:mx-6 mt-3 px-4 py-2 border ow-mono text-[11px]"
                  style={{
                    borderColor: actionMsg.ok ? '#3FB950' : '#E12E38',
                    color:       actionMsg.ok ? '#3FB950' : '#E12E38',
                    background:  actionMsg.ok ? 'rgba(63,185,80,0.06)' : 'rgba(225,46,56,0.06)',
                  }}>
                  {actionMsg.ok ? '✓ ' : '✗ '}{actionMsg.text}
                </div>
              )}
              {/* 搜索栏 — 在滚动容器外，不随横向滚动 */}
              <div className="px-3 md:px-6 py-3 border-b flex-shrink-0" style={{ borderColor: 'var(--ow-border)' }}>
                <div className="flex items-center gap-2 border px-3 py-2 max-w-xs"
                  style={{ borderColor: 'var(--ow-border)', background: 'var(--ow-panel)' }}>
                  <span className="ow-mono text-sm" style={{ color: 'var(--ow-text-muted)' }}>{'>'}</span>
                  <input
                    type="text" value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Search username..."
                    className="flex-1 bg-transparent outline-none ow-mono text-[11px]"
                    style={{ color: 'var(--ow-text)' }}
                  />
                </div>
              </div>
              {/* 表头 + 用户列表：同一 overflow-x-auto 容器，避免双滚动条 */}
              <div className="flex-1 overflow-x-auto overflow-y-auto min-h-0">
              <div className="grid gap-x-3 px-5 py-2 border-b sticky top-0"
                style={{
                  gridTemplateColumns: '2.5rem minmax(10rem, 1fr) 6rem 7rem 4.5rem 8rem 6rem',
                  borderColor: 'var(--ow-border)',
                  background: 'var(--ow-panel-bg-main)',
                  minWidth: '52rem',
                }}>
                {['ID', 'USERNAME', 'GROUP', 'QQ', 'STATUS', 'ADMIN', 'BAN'].map((h, i) => (
                  <div key={i} className="ow-mono text-[9px] uppercase tracking-widest" style={{ color: 'var(--ow-text-muted)' }}>{h}</div>
                ))}
              </div>
              {/* min-w-full 确保行列表至少撑满容器宽度，避免宽屏下右侧留白 */}
              <div>
                {isLoading ? (
                  <div className="flex items-center justify-center h-24">
                    <span className="ow-mono text-[11px] uppercase tracking-widest" style={{ color: 'var(--ow-text-muted)' }}>
                      &gt; Loading users...
                    </span>
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="flex items-center justify-center h-24">
                    <span className="ow-mono text-[11px]" style={{ color: 'var(--ow-text-muted)' }}>NO USERS FOUND</span>
                  </div>
                ) : (
                  filtered.map((u, i) => (
                    <UserRow
                      currentUser={user}
                      key={u.userId}
                      u={u}
                      index={i}
                      onToggleAdmin={handleToggleAdmin}
                      onToggleBan={handleToggleBan}
                      loading={loadingUser === u.userId}
                    />
                  ))
                )}
              </div>
              </div>
            </div>
          )}

          {/* INVITATIONS 内容 */}
          {tab === 'invitations' && (
            <div className="flex flex-col flex-1 min-h-0">
              <InvitationsPanel panelReady={panelReady} />
            </div>
          )}



        </div>
      </PanelReveal>
    </div>
  );
}

'use client';

import { useState, useCallback, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChallengeContent } from '@/components/challenges/ChallengeContent';
import { getChallengeById, deleteChallenge } from '@/lib/api/challenge';
import { submitFlag } from '@/lib/api/flag';
import { getMyInstances, createInstance, deleteInstance, renewInstance } from '@/lib/api/instance';
import type { InstanceInfo } from '@/lib/api/instance';
import { PanelReveal } from '@/components/ow/PanelReveal';
import { GlitchText } from '@/components/ow/GlitchText';
import { useAuthStore } from '@/store/authStore';
import { useChallengesLayout } from '../layout';
import {
  downloadChallengeFile,
  getApiErrorMessage,
  getChallengeFiles,
  type ChallengeFile,
} from '@/lib/api/file';

/**
 * challenges/[id] 详情页 — 仅渲染中栏
 * 左栏、右栏由 challenges/layout.tsx 共享提供（不重播动画）
 */

// ─── 颜色函数 ─────────────────────────────────────────────
function diffColor(diff: string) {
  switch (diff?.toUpperCase()) {
    case 'BABY':   return '#3FB950';
    case 'EASY':   return '#58A6FF';
    case 'MEDIUM': return '#FF6200';
    case 'HARD':   return '#E12E38';
    case 'BOSS':   return '#A855F7';
    default:       return '#8A8A8A';
  }
}

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function AttachmentList({ challengeId }: { challengeId: number }) {
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { data: files = [], isLoading, isError } = useQuery({
    queryKey: ['challenge-files', challengeId],
    queryFn: () => getChallengeFiles(challengeId),
    retry: 1,
  });

  async function handleDownload(file: ChallengeFile) {
    setDownloadingId(file.fileId); setError(null);
    try {
      await downloadChallengeFile(file);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Attachment download failed.'));
    } finally {
      setDownloadingId(null);
    }
  }

  if (isLoading) return <div className="ow-mono text-[10px]" style={{ color: 'var(--ow-text-muted)' }}>&gt; Loading attachments...</div>;
  if (isError) return <div className="ow-mono text-[10px]" style={{ color: '#E12E38' }}>ERR: Failed to load attachments.</div>;
  if (files.length === 0) return null;

  return (
    <div className="border" style={{ borderColor: 'var(--ow-border)', background: 'var(--ow-panel-bg-alt)' }}>
      <div className="px-4 py-2 border-b ow-mono text-[9px] uppercase tracking-widest" style={{ borderColor: 'var(--ow-border)', color: 'var(--ow-text-muted)' }}>ATTACHMENTS // {files.length}</div>
      <div className="divide-y" style={{ borderColor: 'var(--ow-border)' }}>
        {files.map(file => (
          <div key={file.fileId} className="flex flex-col sm:flex-row sm:items-center gap-2 px-4 py-3">
            <div className="flex-1 min-w-0">
              <div className="ow-mono text-[11px] truncate" title={file.originalName} style={{ color: 'var(--ow-text-dim)' }}>{file.originalName}</div>
              <div className="ow-mono text-[9px] mt-0.5" style={{ color: 'var(--ow-text-muted)' }}>{file.mimeType} · {formatFileSize(file.size)}</div>
            </div>
            <button onClick={() => handleDownload(file)} disabled={downloadingId !== null}
              className="px-3 py-1 border ow-mono text-[9px] uppercase disabled:opacity-40"
              style={{ borderColor: '#58A6FF', color: '#58A6FF' }}>
              {downloadingId === file.fileId ? '> DOWNLOADING...' : '[ DOWNLOAD ]'}
            </button>
          </div>
        ))}
      </div>
      {error && <div className="px-4 py-2 border-t ow-mono text-[9px]" style={{ borderColor: '#E12E38', color: '#E12E38' }}>ERR: {error}</div>}
    </div>
  );
}

// ─── 容器控制 ─────────────────────────────────────────────
function ContainerPanel({ challengeId, configId, instances, onRefresh }: {
  challengeId: number; configId: number; instances: InstanceInfo[]; onRefresh: () => void;
}) {
  const running = instances.find(inst => inst.ConfigID === configId);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg]         = useState<string | null>(null);
  const [countdown, setCountdown] = useState('');

  useEffect(() => {
    if (!running) { setCountdown(''); return; }
    const updateTimer = () => {
      const diff = new Date(running.Expiration).getTime() - Date.now();
      if (diff <= 0) { setCountdown('EXPIRED'); return; }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(`${m}m ${String(s).padStart(2, '0')}s`);
    };
    updateTimer();
    const id = setInterval(updateTimer, 1000);
    return () => clearInterval(id);
  }, [running]);

  async function handleCreate() {
    setLoading(true); setMsg(null);
    try { await createInstance(challengeId); setMsg('Container started.'); onRefresh(); }
    catch { setMsg('Failed to start container.'); }
    finally { setLoading(false); }
  }
  async function handleDelete() {
    if (!running) return;
    setLoading(true); setMsg(null);
    try { await deleteInstance(running.ID); setMsg('Container stopped.'); onRefresh(); }
    catch { setMsg('Failed to stop container.'); }
    finally { setLoading(false); }
  }
  async function handleRenew() {
    if (!running) return;
    setLoading(true); setMsg(null);
    try { await renewInstance(running.ID); setMsg('Container renewed.'); onRefresh(); }
    catch { setMsg('Failed to renew container.'); }
    finally { setLoading(false); }
  }

  return (
    <div className="border px-4 py-3" style={{ borderColor: 'var(--ow-border)', background: 'var(--ow-panel-bg-alt)' }}>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-1.5 h-1.5 rounded-full" style={{
          background: running ? '#3FB950' : '#E12E38',
          boxShadow: running ? '0 0 5px rgba(63,185,80,0.6)' : '0 0 4px rgba(225,46,56,0.4)',
        }} />
        <span className="ow-mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--ow-text-dim)' }}>DYNAMIC_INSTANCE</span>
      </div>
      {running ? (
        <div className="space-y-2">
          <div className="ow-mono text-[11px]" style={{ color: '#3FB950' }}>{running.Service}</div>
          <div className="ow-mono text-[10px]" style={{ color: 'var(--ow-text-muted)' }}>
            EXPIRES: <span style={{ color: 'var(--ow-text-dim)' }}>{countdown}</span>
          </div>
          <div className="flex gap-2 mt-2">
            <button onClick={handleRenew} disabled={loading}
              className="px-3 py-1 border ow-mono text-[10px] uppercase transition-colors disabled:opacity-40"
              style={{ borderColor: 'var(--ow-border)', color: 'var(--ow-text-dim)' }}>
              {loading ? '...' : '[ RENEW ]'}
            </button>
            <button onClick={handleDelete} disabled={loading}
              className="px-3 py-1 border ow-mono text-[10px] uppercase transition-colors disabled:opacity-40"
              style={{ borderColor: '#E12E38', color: '#E12E38' }}>
              {loading ? '...' : '[ STOP ]'}
            </button>
          </div>
        </div>
      ) : (
        <button onClick={handleCreate} disabled={loading}
          className="px-4 py-1.5 border ow-mono text-[10px] uppercase transition-colors disabled:opacity-40"
          style={{ borderColor: '#3FB950', color: '#3FB950' }}>
          {loading ? '> STARTING...' : '[ START INSTANCE ]'}
        </button>
      )}
      {msg && <div className="ow-mono text-[10px] mt-2" style={{ color: 'var(--ow-text-dim)' }}>{msg}</div>}
    </div>
  );
}

// ─── FLAG 提交 ────────────────────────────────────────────
function FlagSubmitter({ challengeId, onSolved }: { challengeId: number; onSolved: () => void }) {
  const [flag, setFlag]     = useState('');
  const [status, setStatus] = useState<'idle' | 'ok' | 'wrong' | 'error'>('idle');
  const [msg, setMsg]       = useState('');

  function fireConfetti() {
    const colors = ['#3FB950', '#F5F5F5', '#F5D700', '#58A6FF'];
    confetti({ particleCount: 60, angle: 60,  spread: 55, origin: { x: 0,   y: 0.65 }, colors, ticks: 200, gravity: 1.2, scalar: 0.9 });
    confetti({ particleCount: 60, angle: 120, spread: 55, origin: { x: 1,   y: 0.65 }, colors, ticks: 200, gravity: 1.2, scalar: 0.9 });
    setTimeout(() => {
      confetti({ particleCount: 40, angle: 90, spread: 70, origin: { x: 0.5, y: 0.7 }, colors, ticks: 180, gravity: 1.4, scalar: 0.8 });
    }, 150);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!flag.trim()) return;
    setStatus('idle'); setMsg('');
    try {
      const res = await submitFlag(challengeId, flag.trim());
      if (res.isCorrect && !res.isRepeated) {
        setStatus('ok'); setMsg('Correct!'); fireConfetti(); onSolved();
      } else if (res.isRepeated) {
        setStatus('wrong'); setMsg('Already solved.');
      } else {
        setStatus('wrong'); setMsg('Wrong flag.');
      }
    } catch (err: unknown) {
      setStatus('error');
      const m = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setMsg(typeof m === 'string' ? m : 'Submission failed.');
    }
  }

  const borderColor = status === 'ok' ? '#3FB950' : status === 'wrong' ? '#E12E38' : '#2A2A2A';
  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="ow-mono text-[9px] uppercase tracking-widest mb-2" style={{ color: 'var(--ow-text-muted)' }}>SUBMIT_FLAG</div>
      <div className="flex flex-col md:flex-row gap-2">
        <div className="flex-1 flex items-center gap-2 border px-3 py-2"
          style={{ borderColor, background: 'var(--ow-panel)' }}>
          <span className="ow-mono text-sm" style={{ color: 'var(--ow-text-muted)' }}>{'>'}</span>
          <input type="text" value={flag} onChange={e => setFlag(e.target.value)}
            placeholder="CNSS{...}"
            className="flex-1 bg-transparent outline-none ow-mono text-[12px]"
            style={{ color: 'var(--ow-text)' }} />
        </div>
        <button type="submit"
          className="px-4 py-2 border ow-mono text-[10px] uppercase transition-colors w-full md:w-auto md:flex-shrink-0"
          style={{ borderColor: '#8A8A8A', color: 'var(--ow-text)', background: 'rgba(255,255,255,0.03)' }}>
          [ SUBMIT ]
        </button>
      </div>
      {msg && (
        <div className="ow-mono text-[11px]" style={{ color: status === 'ok' ? '#3FB950' : '#E12E38' }}>
          {status === 'ok' ? '✓ ' : '✗ '}{msg}
        </div>
      )}
    </form>
  );
}

// ─── 中栏：题目详情 ───────────────────────────────────────
function ChallengeDetailPanel({ challengeId, instances, onRefresh, active, solvedCount }: {
  challengeId: number; instances: InstanceInfo[]; onRefresh: () => void; active: boolean; solvedCount?: number;
}) {
  const { user } = useAuthStore();
  const { drawerToggle, activeCategory } = useChallengesLayout();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  const { data: detail, isLoading, isError } = useQuery({
    queryKey: ['challenge', challengeId],
    queryFn: () => getChallengeById(challengeId),
    retry: 1,
  });

  function handleSolved() {
    queryClient.invalidateQueries({ queryKey: ['challenges'] });
    queryClient.invalidateQueries({ queryKey: ['challenges-all-stats'] });
  }

  async function handleDelete() {
    if (!confirm(`确认删除题目「${detail?.title ?? challengeId}」？此操作不可撤销。`)) return;
    setDeleting(true);
    try {
      await deleteChallenge(challengeId);
      queryClient.invalidateQueries({ queryKey: ['challenges'] });
      queryClient.invalidateQueries({ queryKey: ['challenges-all-stats'] });
      router.replace('/challenges');
    } catch {
      alert('删除失败，请重试');
      setDeleting(false);
    }
  }

  if (isLoading) return (
    <div className="flex-1 flex items-center justify-center">
      <span className="ow-mono text-[11px] uppercase tracking-widest" style={{ color: 'var(--ow-text-muted)' }}>
        &gt; Loading...
        <span className="inline-block w-[6px] h-[11px] ml-1 align-middle"
          style={{ background: 'var(--ow-text-muted)', animation: '1s step-end 0s infinite running ow-blink' }} />
      </span>
    </div>
  );
  if (isError || !detail) return (
    <div className="flex-1 flex items-center justify-center">
      <span className="ow-mono text-[11px]" style={{ color: '#E12E38' }}>ERR: Challenge not found</span>
    </div>
  );

  const hasContainer = detail.configId !== -1;
  const isAdmin = ((user?.role ?? 0) > 0);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 头部 */}
      <div className="px-6 py-5 border-b" style={{ borderColor: 'var(--ow-border)' }}>
        {/* 返回按钮 */}
        <button
          onClick={() => router.push(`/challenges?cat=${encodeURIComponent(activeCategory)}`)}
          className="flex items-center gap-1.5 mb-3 group transition-opacity opacity-50 hover:opacity-100"
          aria-label="返回题目列表"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--ow-text-dim)' }}>
            <path d="M8 2L4 6l4 4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="ow-mono text-[9px] uppercase tracking-widest" style={{ color: 'var(--ow-text-dim)' }}>BACK</span>
        </button>

        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2 md:gap-4">
          <GlitchText active={active} text={detail.title.toUpperCase()} tag="h1"
            className="font-['Inter'] text-3xl font-light leading-tight tracking-tight block"
            style={{ color: 'var(--ow-text)' }} duration={600} />
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* 移动端 FILTER 按钮 */}
            <button
              className="md:hidden px-3 py-1 border ow-mono text-[10px] uppercase tracking-widest transition-colors"
              style={{ borderColor: 'var(--ow-border)', color: 'var(--ow-text-dim)' }}
              onClick={drawerToggle}
            >
              [ FILTER ]
            </button>
            {isAdmin && (
              <>
                <a href={`/challenges/new?edit=${challengeId}`}
                  className="px-3 py-1 border ow-mono text-[10px] uppercase transition-colors"
                  style={{ borderColor: '#F5D700', color: '#F5D700' }}>
                  [ EDIT ]
                </a>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-3 py-1 border ow-mono text-[10px] uppercase transition-colors disabled:opacity-40"
                  style={{ borderColor: '#E12E38', color: '#E12E38' }}>
                  {deleting ? '...' : '[ DELETE ]'}
                </button>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center flex-wrap gap-x-4 gap-y-1 mt-2">
          <span className="ow-mono text-[10px] px-1.5 py-0.5 border"
            style={{ borderColor: 'var(--ow-border)', color: 'var(--ow-text-dim)', background: 'rgba(58,58,58,0.2)' }}>
            {detail.category?.toUpperCase()}
          </span>
          <span className="ow-mono text-[10px]" style={{ color: diffColor(detail.difficulty) }}>
            {detail.difficulty?.toUpperCase()}
          </span>
          <span className="ow-mono text-[10px]" style={{ color: '#3FB950' }}>
            {detail.score} pts
          </span>
          <span className="ow-mono text-[10px]" style={{ color: 'var(--ow-text-muted)' }}>
            BY: {detail.creatorUsername ?? String(detail.creatorId)}
          </span>
          {solvedCount !== undefined && (
            <span className="ow-mono text-[10px]" style={{ color: 'var(--ow-text-muted)' }}>
              SOLVED: <span style={{ color: solvedCount > 0 ? '#3FB950' : '#555' }}>{solvedCount}</span>
            </span>
          )}
        </div>
        {detail.tags && detail.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {detail.tags.map(tag => (
              <span key={tag} className="ow-mono text-[9px] px-1.5 py-0.5 border"
                style={{ borderColor: 'var(--ow-border)', color: 'var(--ow-text-muted)' }}>#{tag}</span>
            ))}
          </div>
        )}
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
        {detail.content ? (
          <div className="prose-ow">
            <ChallengeContent content={detail.content} />
          </div>
        ) : (
          <div className="ow-mono text-[11px]" style={{ color: 'var(--ow-text-muted)' }}>&gt; No description available.</div>
        )}

        <div className="border-t" style={{ borderColor: 'var(--ow-border)' }} />

        {user && <AttachmentList challengeId={challengeId} />}

        {hasContainer && (
          <ContainerPanel
            challengeId={challengeId}
            configId={detail.configId}
            instances={instances}
            onRefresh={onRefresh}
          />
        )}

        {user ? (
          <FlagSubmitter challengeId={challengeId} onSolved={handleSolved} />
        ) : (
          <div className="ow-mono text-[11px]" style={{ color: 'var(--ow-text-muted)' }}>
            &gt; Login required to submit flag.
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 主页面 ───────────────────────────────────────────────
export default function ChallengePage() {
  const params = useParams();
  const { isAuthenticated, user } = useAuthStore();
  const { allChallenges } = useChallengesLayout();

  const challengeId = Number(params.id);

  const [centerReady, setCenterReady] = useState(false);
  const onCenterDone = useCallback(() => setCenterReady(true), []);

  const { data: instances = [], refetch: refetchInstances } = useQuery({
    queryKey: ['instances'],
    queryFn: () => getMyInstances(),
    enabled: isAuthenticated,
    retry: 1,
    refetchInterval: 30000,
  });

  const solvedCount = (() => {
    const c = allChallenges.find(c => Number(c.id) === challengeId);
    return c ? (c.solvedCount ?? c.solved ?? 0) : undefined;
  })();

  return (
    <PanelReveal
      delay={0}
      onComplete={onCenterDone}
      className="relative flex flex-col h-full overflow-hidden"
    >
      <ChallengeDetailPanel
        challengeId={challengeId}
        instances={instances}
        onRefresh={() => refetchInstances()}
        active={centerReady}
        solvedCount={solvedCount}
      />
    </PanelReveal>
  );
}

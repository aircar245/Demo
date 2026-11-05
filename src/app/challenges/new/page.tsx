'use client';

import { Suspense, useState, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChallengeContent } from '@/components/challenges/ChallengeContent';
import {
  createChallenge, updateChallenge,
  getChallengeById,
} from '@/lib/api/challenge';
import {
  getFlags, createFlag, updateFlag, deleteFlag,
} from '@/lib/api/flag';
import { PanelReveal } from '@/components/ow/PanelReveal';
import { GlitchText } from '@/components/ow/GlitchText';
import {
  deleteChallengeFile,
  getApiErrorMessage,
  getChallengeFiles,
  uploadChallengeFile,
} from '@/lib/api/file';
import {
  BUILTIN_DIFFICULTIES,
  CUSTOM_DIFFICULTY_OPTION,
  getBuiltinDifficulty,
  getScoringPreset,
  isBuiltinDifficulty,
  normalizeDifficulty,
} from '@/lib/challenge-scoring';

/**
 * 管理员创建/编辑题目页
 *
 * URL:
 *   /challenges/new          — 创建模式
 *   /challenges/new?edit=42  — 编辑模式（加载已有题目）
 *
 * 由布局统一核验管理员身份后才挂载编辑器。
 */

const CATEGORY_OPTIONS = [
  'web','pwn','crypto','re','misc','dev','sa','design','hpc','blockchain','notice',
];
const DIFFICULTY_OPTIONS = [...BUILTIN_DIFFICULTIES, CUSTOM_DIFFICULTY_OPTION];

function parsePositiveInteger(value: string): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

interface FormState {
  title:      string;
  content:    string;
  score:      string;
  baseScore:  string;
  declineSpeed: string;
  category:   string;
  difficulty: string;
  customDifficulty: string;
  tags:       string;       // 逗号分隔
  tagVisible: boolean;
  isHidden:   boolean;
  config_id:  string;       // -1 = 无容器
}

const MAX_ATTACHMENT_SIZE = 100 * 1024 * 1024;
const ATTACHMENT_ACCEPT = '.zip,.pdf,.txt,.png,application/zip,application/pdf,text/plain,image/png';

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function AttachmentManager({ challengeId }: { challengeId: number }) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const queryKey = ['challenge-files', challengeId];
  const { data: files = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => getChallengeFiles(challengeId),
    retry: 1,
  });

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > MAX_ATTACHMENT_SIZE) {
      setMsg({ text: 'File exceeds the 100 MB limit.', ok: false });
      return;
    }

    setBusy(true); setMsg(null);
    try {
      await uploadChallengeFile(challengeId, file);
      await queryClient.invalidateQueries({ queryKey });
      setMsg({ text: `${file.name} uploaded.`, ok: true });
    } catch (error) {
      setMsg({ text: getApiErrorMessage(error, 'Failed to upload attachment.'), ok: false });
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(fileId: number, name: string) {
    setDeletingId(fileId); setMsg(null);
    try {
      await deleteChallengeFile(fileId);
      await queryClient.invalidateQueries({ queryKey });
      setMsg({ text: `${name} deleted.`, ok: true });
    } catch (error) {
      setMsg({ text: getApiErrorMessage(error, 'Failed to delete attachment.'), ok: false });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 pb-2 border-b" style={{ borderColor: 'var(--ow-border)' }}>
        <span className="ow-mono text-[9px] uppercase tracking-widest" style={{ color: 'var(--ow-text-muted)' }}>ATTACHMENTS</span>
        <button onClick={() => inputRef.current?.click()} disabled={busy}
          className="px-2 py-1 border ow-mono text-[9px] uppercase disabled:opacity-40"
          style={{ borderColor: '#58A6FF', color: '#58A6FF' }}>
          {busy ? 'UPLOADING...' : '[ + UPLOAD ]'}
        </button>
        <input ref={inputRef} type="file" accept={ATTACHMENT_ACCEPT} className="hidden" onChange={handleUpload} />
      </div>
      <div className="ow-mono text-[8px]" style={{ color: 'var(--ow-text-muted)' }}>ZIP / PDF / TXT / PNG · MAX 100 MB</div>
      {isLoading ? (
        <div className="ow-mono text-[10px]" style={{ color: 'var(--ow-text-muted)' }}>Loading...</div>
      ) : files.length === 0 ? (
        <div className="ow-mono text-[10px]" style={{ color: 'var(--ow-text-muted)' }}>No attachments yet.</div>
      ) : (
        <div className="space-y-1">
          {files.map(file => (
            <div key={file.fileId} className="flex items-center gap-2 border px-2 py-1.5"
              style={{ borderColor: 'var(--ow-border)', background: 'var(--ow-panel-bg-alt)' }}>
              <div className="flex-1 min-w-0">
                <div className="ow-mono text-[10px] truncate" title={file.originalName} style={{ color: 'var(--ow-text-dim)' }}>{file.originalName}</div>
                <div className="ow-mono text-[8px]" style={{ color: 'var(--ow-text-muted)' }}>{formatFileSize(file.size)}</div>
              </div>
              <button onClick={() => handleDelete(file.fileId, file.originalName)} disabled={deletingId !== null}
                className="ow-mono text-[9px] px-1.5 py-0.5 border disabled:opacity-40"
                style={{ borderColor: '#E12E38', color: '#E12E38' }}>
                {deletingId === file.fileId ? '...' : '✕'}
              </button>
            </div>
          ))}
        </div>
      )}
      {msg && <div className="ow-mono text-[9px]" style={{ color: msg.ok ? '#3FB950' : '#E12E38' }}>{msg.ok ? '✓ ' : '✗ '}{msg.text}</div>}
    </div>
  );
}

const DEFAULT_FORM: FormState = {
  title:      '',
  content:    '',
  score:      '1000',
  baseScore:  '650',
  declineSpeed: '67',
  category:   'web',
  difficulty: 'Easy',
  customDifficulty: '',
  tags:       '',
  tagVisible: false,
  isHidden:   false,
  config_id:  '-1',
};

// ─── Markdown 分栏编辑器 ────────────────────────────────
function MarkdownEditor({
  value, onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [tab, setTab] = useState<'edit' | 'preview' | 'split'>('split');
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    onChange(text);
  }

  return (
    <div className="flex flex-col h-full border" style={{ borderColor: 'var(--ow-border)' }}>
      {/* 工具栏 */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b" style={{ borderColor: 'var(--ow-border)', background: 'var(--ow-panel-bg-alt)' }}>
        <div className="flex gap-1">
          {(['edit', 'preview', 'split'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="ow-mono text-[9px] px-2 py-0.5 border uppercase transition-colors"
              style={{
                borderColor: tab === t ? '#8A8A8A' : '#2A2A2A',
                color:       tab === t ? '#F5F5F5' : '#555',
                background:  tab === t ? 'rgba(255,255,255,0.04)' : 'transparent',
              }}>
              {t}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fileRef.current?.click()}
            className="ow-mono text-[9px] px-2 py-0.5 border uppercase transition-colors"
            style={{ borderColor: 'var(--ow-border)', color: 'var(--ow-text-muted)' }}
            title="Upload .md file">
            [ UPLOAD .MD ]
          </button>
          <input ref={fileRef} type="file" accept=".md,.txt" className="hidden" onChange={handleFileUpload} />
        </div>
      </div>

      {/* 编辑区 */}
      <div className="flex flex-1 min-h-0">
        {(tab === 'edit' || tab === 'split') && (
          <textarea
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder="# Challenge Title&#10;&#10;## Description&#10;&#10;Write challenge description here..."
            className="flex-1 bg-transparent outline-none resize-none p-4 ow-mono text-[12px] leading-relaxed"
            style={{
              color: 'var(--ow-text-mid)',
              borderRight: tab === 'split' ? '1px solid #1A1A1A' : 'none',
            }}
            spellCheck={false}
          />
        )}
        {(tab === 'preview' || tab === 'split') && (
          <div className="flex-1 overflow-y-auto p-4 prose-ow" style={{ minWidth: 0 }}>
            {value ? (
              <ChallengeContent content={value} />
            ) : (
              <span className="ow-mono text-[11px]" style={{ color: 'var(--ow-text-muted)' }}>Preview will appear here...</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 表单字段行 ──────────────────────────────────────────
function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="ow-mono text-[9px] uppercase tracking-widest" style={{ color: 'var(--ow-text-muted)' }}>
        {label}
      </label>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function TextInput({
  value, onChange, placeholder, type = 'text', ariaLabel, min, step,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  ariaLabel?: string;
  min?: number;
  step?: number;
}) {
  return (
    <div className="flex items-center gap-2 border px-3 py-2" style={{ borderColor: 'var(--ow-border)', background: 'var(--ow-panel)' }}>
      <span className="ow-mono text-sm" style={{ color: 'var(--ow-text-muted)' }}>{'>'}</span>
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        min={min}
        step={step}
        className="flex-1 bg-transparent outline-none ow-mono text-[12px]"
        style={{ color: 'var(--ow-text)' }}
      />
    </div>
  );
}

function SelectInput({
  value, onChange, options, ariaLabel,
}: {
  value: string; onChange: (v: string) => void; options: readonly string[]; ariaLabel?: string;
}) {
  return (
    <select
      value={value} onChange={e => onChange(e.target.value)}
      aria-label={ariaLabel}
      className="border px-3 py-2 bg-transparent ow-mono text-[12px] outline-none appearance-none cursor-pointer"
      style={{ borderColor: 'var(--ow-border)', background: 'var(--ow-panel)', color: 'var(--ow-text)' }}
    >
      {options.map(o => (
        <option key={o} value={o} style={{ background: 'var(--ow-panel)' }}>
          {o}
        </option>
      ))}
    </select>
  );
}

// ─── Flag 管理组件（编辑模式下显示）────────────────────
function FlagManager({ challengeId }: { challengeId: number }) {
  const queryClient = useQueryClient();
  const [newFlag, setNewFlag]   = useState('');
  const [newScore, setNewScore] = useState('');
  const [newBroadcast, setNewBroadcast] = useState(false);
  const [editingFlag, setEditingFlag] = useState<{ id: number; content: string; score: string; isBroadcast: boolean } | null>(null);
  const [msg, setMsg]           = useState<{ text: string; ok: boolean } | null>(null);
  const [loading, setLoading]   = useState(false);

  const { data: flags = [], isLoading } = useQuery({
    queryKey: ['flags', challengeId],
    queryFn: () => getFlags(challengeId),
    retry: 1,
  });

  async function handleAdd() {
    if (!newFlag.trim()) return;
    setLoading(true); setMsg(null);
    try {
      await createFlag(challengeId, newFlag.trim(), Number(newScore) || 0, newBroadcast);
      queryClient.invalidateQueries({ queryKey: ['flags', challengeId] });
      setNewFlag(''); setNewScore(''); setNewBroadcast(false);
      setMsg({ text: 'Flag added.', ok: true });
    } catch (e: unknown) {
      const m = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setMsg({ text: typeof m === 'string' ? m : 'Failed to add flag.', ok: false });
    } finally { setLoading(false); }
  }

  async function handleUpdate() {
    if (!editingFlag || !editingFlag.content.trim() || !Number.isFinite(Number(editingFlag.score))) return;
    setLoading(true); setMsg(null);
    try {
      await updateFlag(editingFlag.id, editingFlag.content.trim(), Number(editingFlag.score), challengeId, editingFlag.isBroadcast);
      await queryClient.invalidateQueries({ queryKey: ['flags', challengeId] });
      setEditingFlag(null);
      setMsg({ text: 'Flag 已更新。', ok: true });
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setMsg({ text: typeof message === 'string' ? message : '更新 Flag 失败。', ok: false });
    } finally { setLoading(false); }
  }

  async function handleDelete(flagId: number) {
    setLoading(true); setMsg(null);
    try {
      await deleteFlag(flagId);
      queryClient.invalidateQueries({ queryKey: ['flags', challengeId] });
      setMsg({ text: 'Flag deleted.', ok: true });
    } catch {
      setMsg({ text: 'Failed to delete flag.', ok: false });
    } finally { setLoading(false); }
  }

  return (
    <div className="space-y-3">
      <div className="ow-mono text-[9px] uppercase tracking-widest pb-2 border-b"
        style={{ color: 'var(--ow-text-muted)', borderColor: 'var(--ow-border)' }}>
        FLAGS
      </div>

      {/* 现有 flags */}
      {isLoading ? (
        <div className="ow-mono text-[10px]" style={{ color: 'var(--ow-text-muted)' }}>Loading...</div>
      ) : flags.length === 0 ? (
        <div className="ow-mono text-[10px]" style={{ color: 'var(--ow-text-muted)' }}>No flags yet.</div>
      ) : (
        <div className="space-y-1">
          {flags.map(f => (
            <div key={f.id} className="flex flex-wrap items-center gap-2 border px-2 py-1"
              style={{ borderColor: 'var(--ow-border)', background: 'var(--ow-panel-bg-alt)' }}>
              {editingFlag?.id === f.id ? <>
                <input aria-label="Flag 内容" value={editingFlag.content} disabled={loading} onChange={e => setEditingFlag({ ...editingFlag, content: e.target.value })} className="min-w-0 flex-1 bg-transparent border p-1 ow-mono text-xs" />
                <input aria-label="Flag 分数" type="number" value={editingFlag.score} disabled={loading} onChange={e => setEditingFlag({ ...editingFlag, score: e.target.value })} className="w-20 bg-transparent border p-1 ow-mono text-xs" />
                <label className="text-xs"><input type="checkbox" checked={editingFlag.isBroadcast} disabled={loading} onChange={e => setEditingFlag({ ...editingFlag, isBroadcast: e.target.checked })} /> 解题播报</label>
                <button type="button" onClick={handleUpdate} disabled={loading || !editingFlag.content.trim()} className="border p-1 text-xs">保存</button>
                <button type="button" onClick={() => setEditingFlag(null)} disabled={loading} className="border p-1 text-xs">取消</button>
              </> : <>
              <span className="ow-mono text-[10px] flex-1 truncate" style={{ color: '#3FB950' }}>
                {f.content}
              </span>
              <span className="ow-mono text-[9px]" style={{ color: 'var(--ow-text-muted)' }}>
                +{f.score} · {f.isBroadcast ? '播报开启' : '播报关闭'}
              </span>
              <button type="button" onClick={() => setEditingFlag({ id: f.id, content: f.content, score: String(f.score), isBroadcast: f.isBroadcast })} disabled={loading} className="border p-1 text-xs">编辑</button>
              <button type="button"
                aria-label={`删除 Flag ${f.id}`}
                onClick={() => handleDelete(f.id)}
                disabled={loading}
                className="ow-mono text-[9px] px-1.5 py-0.5 border transition-colors disabled:opacity-40"
                style={{ borderColor: '#E12E38', color: '#E12E38' }}>
                ✕
              </button>
              </>}
            </div>
          ))}
        </div>
      )}

      {/* 新增 flag */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2 border px-2 py-1.5"
          style={{ borderColor: 'var(--ow-border)', background: 'var(--ow-panel)' }}>
          <span className="ow-mono text-[10px]" style={{ color: 'var(--ow-text-muted)' }}>{'>'}</span>
          <input
            type="text" value={newFlag} onChange={e => setNewFlag(e.target.value)}
            placeholder="CNSS{flag_content}"
            className="flex-1 bg-transparent outline-none ow-mono text-[11px] min-w-0"
            style={{ color: '#3FB950' }}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
        </div>
        <div className="flex gap-2">
          <div className="flex items-center gap-1 border px-2 py-1"
            style={{ borderColor: 'var(--ow-border)', background: 'var(--ow-panel)', width: '80px' }}>
            <input
              type="number" value={newScore} onChange={e => setNewScore(e.target.value)}
              placeholder="pts"
              className="w-full bg-transparent outline-none ow-mono text-[11px]"
              style={{ color: 'var(--ow-text)' }}
            />
          </div>
          <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={newBroadcast} onChange={e => setNewBroadcast(e.target.checked)} /> 解题播报</label>
          <button type="button"
            onClick={handleAdd} disabled={loading || !newFlag.trim()}
            className="px-3 py-1 border ow-mono text-[9px] uppercase transition-colors disabled:opacity-40"
            style={{ borderColor: '#3FB950', color: '#3FB950' }}>
            {loading ? '...' : '[ ADD ]'}
          </button>
        </div>
      </div>

      {msg && (
        <div className="ow-mono text-[9px]" style={{ color: msg.ok ? '#3FB950' : '#E12E38' }}>
          {msg.ok ? '✓ ' : '✗ '}{msg.text}
        </div>
      )}
    </div>
  );
}

// ─── 主页面 ──────────────────────────────────────────────
function ChallengeEditorPageContent() {
  const router        = useRouter();
  const searchParams  = useSearchParams();
  const queryClient   = useQueryClient();

  const editId  = searchParams.get('edit') ? Number(searchParams.get('edit')) : null;
  const isEdit  = editId !== null;

  // ⚠️ useCallback 稳定引用，避免 PanelReveal useEffect([delay, onComplete]) 重播动画
  const [panelReady, setPanelReady] = useState(false);
  const onPanelComplete = useCallback(() => setPanelReady(true), []);

  const [form, setForm]   = useState<FormState>(DEFAULT_FORM);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // 编辑模式：加载已有题目
  useQuery({
    queryKey: ['challenge', editId],
    queryFn: async () => {
      const d = await getChallengeById(editId!);
      const storedDifficulty = d.difficulty?.trim() || 'Easy';
      const builtinDifficulty = getBuiltinDifficulty(storedDifficulty);
      const fallbackPreset = getScoringPreset(d.category, builtinDifficulty ?? 'Easy');
      setForm({
        title:      d.title,
        content:    d.content ?? '',
        score:      String(d.score),
        baseScore:  String(d.baseScore ?? fallbackPreset.baseScore),
        declineSpeed: String(d.declineSpeed ?? fallbackPreset.declineSpeed),
        category:   d.category,
        difficulty: builtinDifficulty ?? CUSTOM_DIFFICULTY_OPTION,
        customDifficulty: builtinDifficulty ? '' : storedDifficulty,
        tags:       (d.tags ?? []).join(', '),
        tagVisible: d.tagVisible ?? false,
        isHidden:   d.isHidden ?? false,
        config_id:  String(d.configId ?? -1),
      });
      return d;
    },
    enabled: isEdit,
  });

  function update(key: keyof FormState, value: string | boolean) {
    setForm(f => ({ ...f, [key]: value }));
  }

  function updateCategory(category: string) {
    setForm(current => {
      const builtinDifficulty = getBuiltinDifficulty(current.difficulty);
      if (!builtinDifficulty) return { ...current, category };
      const preset = getScoringPreset(category, builtinDifficulty);
      return {
        ...current,
        category,
        baseScore: String(preset.baseScore),
        declineSpeed: String(preset.declineSpeed),
      };
    });
  }

  function updateDifficulty(difficulty: string) {
    setForm(current => {
      const builtinDifficulty = getBuiltinDifficulty(difficulty);
      if (!builtinDifficulty) return { ...current, difficulty };
      const preset = getScoringPreset(current.category, builtinDifficulty);
      return {
        ...current,
        difficulty: builtinDifficulty,
        baseScore: String(preset.baseScore),
        declineSpeed: String(preset.declineSpeed),
      };
    });
  }

  async function handleSave() {
    if (!form.title.trim()) { setError('Title is required.'); return; }
    if (!form.category)     { setError('Category is required.'); return; }

    const difficulty = form.difficulty === CUSTOM_DIFFICULTY_OPTION
      ? form.customDifficulty.trim()
      : form.difficulty;
    if (form.difficulty === CUSTOM_DIFFICULTY_OPTION) {
      if (!difficulty) { setError('Custom difficulty name is required.'); return; }
      if (Array.from(difficulty).length > 255) { setError('Custom difficulty name must be 255 characters or fewer.'); return; }
      const normalizedDifficulty = normalizeDifficulty(difficulty);
      if (
        normalizedDifficulty === 'ALL'
        || normalizedDifficulty === normalizeDifficulty(CUSTOM_DIFFICULTY_OPTION)
        || isBuiltinDifficulty(difficulty)
      ) {
        setError('Custom difficulty name conflicts with a reserved difficulty.');
        return;
      }
    }

    const score = parsePositiveInteger(form.score);
    if (score === null) { setError('Score must be a positive integer.'); return; }
    const baseScore = parsePositiveInteger(form.baseScore);
    if (baseScore === null) { setError('Base score must be a positive integer.'); return; }
    const declineSpeed = parsePositiveInteger(form.declineSpeed);
    if (declineSpeed === null) { setError('Decline speed must be a positive integer.'); return; }
    if (baseScore > score) { setError('Base score cannot exceed score.'); return; }

    setSaving(true); setError(null); setSuccess(null);

    const tags = form.tags
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);

    try {
      if (isEdit) {
        await updateChallenge(editId!, {
          title:      form.title,
          content:    form.content,
          score,
          baseScore,
          declineSpeed,
          category:   form.category,
          difficulty,
          tags,
          tagVisible: form.tagVisible,
          isHidden:   form.isHidden,
        });
        setSuccess('Challenge updated.');
        queryClient.invalidateQueries({ queryKey: ['challenge', editId] });
        queryClient.invalidateQueries({ queryKey: ['challenges'] });
        router.push(
          `/challenges/${editId}?from=${encodeURIComponent(form.category)}`,
        );
      } else {
        const res = await createChallenge({
          title:      form.title,
          content:    form.content,
          score,
          baseScore,
          declineSpeed,
          category:   form.category,
          difficulty,
          tags,
          tagVisible: form.tagVisible,
          isHidden:   form.isHidden,
          config_id:  Number(form.config_id),
        });
        setSuccess(`Challenge created (ID: ${res.challengeId ?? '?'}).`);
        queryClient.invalidateQueries({ queryKey: ['challenges'] });
        queryClient.invalidateQueries({ queryKey: ['challenges-all-stats'] });
        // 创建成功后跳转，带上 category 参数
        if (res.challengeId) {
          setTimeout(() => router.push(
            `/challenges/${res.challengeId}?category=${encodeURIComponent(form.category)}`
          ), 1800);
        }
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(typeof msg === 'string' ? msg : 'Failed to save challenge.');
    } finally {
      setSaving(false);
    }
  }

  const panelBase  = "relative flex flex-col overflow-hidden";
  const panelStyle = { background: 'var(--ow-panel-bg-main)' };

  return (
    <div className="flex min-h-[calc(100dvh-3rem)] p-3 md:p-4 gap-3 md:gap-4" style={{ background: 'var(--ow-bg)' }}>
      <PanelReveal delay={0} onComplete={onPanelComplete}
        className={`${panelBase} flex-1 min-w-0`} style={panelStyle}>
        <div className="flex flex-col h-full">

          {/* 顶部标题栏 */}
          <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--ow-border)' }}>
            {/* 移动端：标题和按钮竖排；桌面端：横排 */}
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <GlitchText active={panelReady}
                  text={isEdit ? 'EDIT_CHALLENGE' : 'NEW_CHALLENGE'}
                  tag="h1"
                  className="font-['Inter'] text-3xl font-light leading-none tracking-tight block"
                  style={{ color: 'var(--ow-text)' }} duration={600} />
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#F5D700', boxShadow: '0 0 5px rgba(245,215,0,0.5)' }} />
                  <span className="ow-mono text-[9px] uppercase tracking-widest" style={{ color: 'var(--ow-text-muted)' }}>
                    ADMIN_MODE
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <button
                  onClick={() => router.back()}
                  className="px-3 py-1.5 border ow-mono text-[10px] uppercase transition-colors whitespace-nowrap"
                  style={{ borderColor: 'var(--ow-border)', color: 'var(--ow-text-muted)' }}>
                  [ CANCEL ]
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-1.5 border ow-mono text-[10px] uppercase transition-colors disabled:opacity-40 whitespace-nowrap"
                  style={{ borderColor: '#F5D700', color: '#F5D700', background: saving ? 'transparent' : 'rgba(245,215,0,0.04)' }}>
                  {saving ? '> SAVING...' : isEdit ? '[ UPDATE ]' : '[ CREATE ]'}
                </button>
              </div>
            </div>
          </div>

          {/* 错误/成功提示 */}
          {error && (
            <div className="mx-6 mt-3 px-4 py-2 border ow-mono text-[11px]"
              style={{ borderColor: '#E12E38', color: '#E12E38', background: 'rgba(225,46,56,0.06)' }}>
              ERR: {error}
            </div>
          )}
          {success && (
            <div className="mx-6 mt-3 px-4 py-2 border ow-mono text-[11px]"
              style={{ borderColor: '#3FB950', color: '#3FB950', background: 'rgba(63,185,80,0.06)' }}>
              ✓ {success}
            </div>
          )}

          {/* 表单区 + 编辑器 */}
          <div className="flex flex-col md:flex-row flex-1 min-h-0 gap-4 p-3 md:p-6 overflow-hidden">

            {/* 左：元信息表单 — 移动端限制最大高度，桌面端固定宽度 */}
            <div className="w-full max-h-[45vh] md:max-h-none md:w-[260px] md:flex-shrink-0 overflow-y-auto space-y-4 pr-1">
              <div className="ow-mono text-[9px] uppercase tracking-widest pb-2 border-b" style={{ color: 'var(--ow-text-muted)', borderColor: 'var(--ow-border)' }}>
                METADATA
              </div>

              <FormRow label="TITLE">
                <TextInput ariaLabel="Title" value={form.title} onChange={v => update('title', v)} placeholder="Challenge title" />
              </FormRow>

              <FormRow label="CATEGORY">
                <SelectInput
                  value={form.category}
                  onChange={updateCategory}
                  options={CATEGORY_OPTIONS}
                  ariaLabel="Category"
                />
              </FormRow>

              <FormRow label="DIFFICULTY">
                <SelectInput
                  value={form.difficulty}
                  onChange={updateDifficulty}
                  options={DIFFICULTY_OPTIONS}
                  ariaLabel="Difficulty"
                />
              </FormRow>

              {form.difficulty === CUSTOM_DIFFICULTY_OPTION && (
                <FormRow label="CUSTOM_DIFFICULTY">
                  <TextInput
                    ariaLabel="Custom difficulty name"
                    value={form.customDifficulty}
                    onChange={v => update('customDifficulty', v)}
                    placeholder="Expert+"
                  />
                </FormRow>
              )}

              <FormRow label="SCORE">
                <TextInput ariaLabel="Score" value={form.score} onChange={v => update('score', v)} type="number" min={1} step={1} placeholder="1000" />
              </FormRow>

              <FormRow label="BASE_SCORE">
                <TextInput ariaLabel="Base score" value={form.baseScore} onChange={v => update('baseScore', v)} type="number" min={1} step={1} placeholder="650" />
              </FormRow>

              <FormRow label="DECLINE_SPEED">
                <TextInput ariaLabel="Decline speed" value={form.declineSpeed} onChange={v => update('declineSpeed', v)} type="number" min={1} step={1} placeholder="67" />
              </FormRow>

              <FormRow label="TAGS">
                <TextInput value={form.tags} onChange={v => update('tags', v)} placeholder="tag1, tag2, tag3" />
              </FormRow>

              <FormRow label="CONFIG_ID">
                <TextInput value={form.config_id} onChange={v => update('config_id', v)} type="number" placeholder="-1 (no container)" />
              </FormRow>

              {/* 布尔选项 */}
              <div className="space-y-2 pt-2 border-t" style={{ borderColor: 'var(--ow-border)' }}>
                {[
                  { key: 'isHidden'   as const, label: 'HIDDEN'      },
                  { key: 'tagVisible' as const, label: 'TAGS_VISIBLE' },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-3 cursor-pointer">
                    <div
                      onClick={() => update(key, !form[key])}
                      className="w-4 h-4 border flex items-center justify-center flex-shrink-0 transition-colors cursor-pointer"
                      style={{
                        borderColor: form[key] ? '#F5D700' : '#2A2A2A',
                        background:  form[key] ? 'rgba(245,215,0,0.1)' : 'transparent',
                      }}>
                      {form[key] && <span style={{ color: '#F5D700', fontSize: '10px', lineHeight: 1 }}>✓</span>}
                    </div>
                    <span className="ow-mono text-[10px] uppercase tracking-widest" style={{ color: form[key] ? '#F5D700' : '#555' }}>
                      {label}
                    </span>
                  </label>
                ))}
              </div>

              {/* 编辑模式下显示 Flag 管理 */}
              {isEdit && editId && (
                <div className="pt-2 border-t" style={{ borderColor: 'var(--ow-border)' }}>
                  <FlagManager challengeId={editId} />
                </div>
              )}

              {isEdit && editId && (
                <div className="pt-2 border-t" style={{ borderColor: 'var(--ow-border)' }}>
                  <AttachmentManager challengeId={editId} />
                </div>
              )}

              {/* 创建模式下提示 */}
              {!isEdit && (
                <div className="pt-2 border-t ow-mono text-[9px]" style={{ borderColor: 'var(--ow-border)', color: 'var(--ow-text-muted)' }}>
                  Save first, then add flags and attachments in edit mode.
                </div>
              )}
            </div>

            {/* 右：Markdown 编辑器 — 移动端需要显式最小高度 */}
            <div className="flex-1 min-h-[40vh] md:min-h-0 flex flex-col min-w-0">
              <div className="ow-mono text-[9px] uppercase tracking-widest pb-2 mb-2 border-b" style={{ color: 'var(--ow-text-muted)', borderColor: 'var(--ow-border)' }}>
                CONTENT (MARKDOWN)
              </div>
              <div className="flex-1 min-h-0">
                <MarkdownEditor
                  value={form.content}
                  onChange={v => update('content', v)}
                />
              </div>
            </div>
          </div>
        </div>
      </PanelReveal>
    </div>
  );
}

export default function ChallengeEditorPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" style={{ background: 'var(--ow-bg)' }} />}>
      <ChallengeEditorPageContent />
    </Suspense>
  );
}

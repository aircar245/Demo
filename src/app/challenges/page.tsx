'use client';

import { useState, useCallback, useRef, useEffect, useMemo, Suspense } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { getChallengesByCategory, swapChallenges } from '@/lib/api/challenge';
import { getMyInstances } from '@/lib/api/instance';
import type { ChallengeByCategory } from '@/types/challenge';
import type { InstanceInfo } from '@/lib/api/instance';
import { PanelReveal } from '@/components/ow/PanelReveal';
import { GlitchText } from '@/components/ow/GlitchText';
import { useAuthStore } from '@/store/authStore';
import { useChallengesLayout } from './layout';
import {
  buildDifficultyFilterOptions,
  normalizeDifficulty,
} from '@/lib/challenge-scoring';

/**
 * challenges/ 列表页 — 仅渲染中栏
 * 左栏、右栏由 challenges/layout.tsx 共享提供
 */

const RESULTS      = ['ALL', 'UNSOLVED', 'SOLVED'] as const;
type Result     = typeof RESULTS[number];

function sliceTags(tags: string[], budget = 20): { visible: string[]; rest: number } {
  const visible: string[] = [];
  let used = 0;
  for (let i = 0; i < tags.length; i++) {
    const w = tags[i].length + 2;
    const badgeW = i < tags.length - 1 ? 3 : 0;
    if (used + w + badgeW <= budget || visible.length === 0) {
      visible.push(tags[i]);
      used += w;
    } else {
      break;
    }
  }
  return { visible, rest: tags.length - visible.length };
}

function diffColor(diff: string) {
  switch (diff.toUpperCase()) {
    case 'BABY':   return '#3FB950';
    case 'EASY':   return '#58A6FF';
    case 'MEDIUM': return '#FF6200';
    case 'HARD':   return '#E12E38';
    case 'BOSS':   return '#A855F7';
    default:       return '#8A8A8A';
  }
}

// -------- 题目行 --------
function ChallengeRow({
  ch, index, active, instances, isAdmin, reorderMode, dragHandleProps, isDragging, onClick,
}: {
  ch: ChallengeByCategory;
  index: number;
  active: boolean;
  instances: InstanceInfo[];
  isAdmin: boolean;
  reorderMode: boolean;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
  isDragging?: boolean;
  onClick: () => void;
}) {
  const solved = ch.yourScore > 0;
  const rowDelay = index * 60;
  const hasContainer = ch.configId !== -1 && ch.configId !== undefined;
  const runningInstance = hasContainer
    ? instances.find(inst => inst.ConfigID === ch.configId)
    : undefined;

  return (
    <div
      className="flex items-center border-b border-l-2 transition-colors duration-100"
      style={{
        borderBottomColor: '#1A1A1A',
        borderLeftColor: ch.isHidden ? '#E12E38' : (solved ? '#3FB950' : 'transparent'),
        opacity: isDragging ? 0.4 : (active ? 1 : 0),
        transition: `opacity 0.15s ease ${isDragging ? 0 : rowDelay}ms`,
        background: isDragging ? 'rgba(245,215,0,0.04)' : undefined,
      }}
      onMouseEnter={e => { if (!isDragging) e.currentTarget.style.background = 'rgba(255,255,255,0.015)'; }}
      onMouseLeave={e => { if (!isDragging) e.currentTarget.style.background = 'transparent'; }}
    >
      {reorderMode && (
        <div
          {...dragHandleProps}
          className="flex-shrink-0 flex items-center justify-center w-8 self-stretch cursor-grab active:cursor-grabbing select-none"
          style={{ color: 'var(--ow-text-muted)', fontSize: '14px', letterSpacing: '-1px' }}
          title="拖动调整顺序"
        >
          ⠿
        </div>
      )}

      <div
        className="flex-1 grid gap-2 md:gap-3 px-3 md:px-5 py-4 items-center min-w-0"
        style={{
          gridTemplateColumns: hasContainer ? 'var(--cols-container)' : 'var(--cols-normal)',
          cursor: reorderMode ? 'default' : 'pointer',
        }}
        onClick={reorderMode ? undefined : onClick}
      >
        <div
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ background: diffColor(ch.difficulty), boxShadow: `0 0 4px ${diffColor(ch.difficulty)}80` }}
        />
        <div
          className="ow-mono text-[10px] px-1 py-0.5 border truncate hidden md:block"
          style={{ borderColor: 'var(--ow-border)', color: 'var(--ow-text-dim)', background: 'rgba(58,58,58,0.2)' }}
        >
          <GlitchText
            active={active}
            text={ch.category?.toUpperCase() ?? ''}
            duration={200 + index * 10}
            style={{ color: 'var(--ow-text-dim)' }}
          />
        </div>
        <div className="flex items-center gap-1.5 min-w-0">
          <GlitchText
            active={active}
            text={ch.title ?? ''}
            duration={400 + index * 15}
            className="ow-mono text-[12px] font-light truncate block"
            style={{ color: solved ? '#8A8A8A' : '#BFBFBF' }}
          />
          {isAdmin && ch.isHidden && (
            <span
              className="ow-mono text-[8px] px-1 py-0.5 border flex-shrink-0 uppercase tracking-wide"
              style={{ borderColor: '#E12E38', color: '#E12E38', background: 'rgba(225,46,56,0.08)' }}
            >
              HIDDEN
            </span>
          )}
        </div>
        <div className="hidden md:flex items-center gap-1 min-w-0 overflow-hidden">
          {(() => {
            const tags = ch.tags ?? [];
            const hidIndicator = isAdmin && ch.tagVisible === false && tags.length > 0;
            const { visible, rest } = sliceTags(tags, hidIndicator ? 15 : 20);
            return (
              <>
                {visible.map(tag => (
                  <span
                    key={tag}
                    className="ow-mono text-[9px] px-1 py-0.5 border flex-shrink-0"
                    style={{ borderColor: 'var(--ow-border)', color: 'var(--ow-text-muted)', background: 'rgba(42,42,42,0.3)' }}
                  >
                    #{tag}
                  </span>
                ))}
                {rest > 0 && (
                  <span className="ow-mono text-[9px] flex-shrink-0" style={{ color: 'var(--ow-text-muted)' }}>
                    +{rest}
                  </span>
                )}
                {hidIndicator && (
                  <span
                    className="ow-mono text-[8px] px-1 py-0.5 border flex-shrink-0"
                    style={{ borderColor: '#FF6200', color: '#FF6200', background: 'rgba(255,98,0,0.08)' }}
                    title="Tags 对普通用户不可见"
                  >
                    T·HID
                  </span>
                )}
              </>
            );
          })()}
        </div>
        <div className="ow-mono text-[11px] text-right">
          <GlitchText
            active={active}
            text={solved ? `+${ch.yourScore}` : String(ch.score)}
            duration={250 + index * 10}
            className="block"
            style={{ color: solved ? '#3FB950' : '#555' }}
          />
        </div>
        {hasContainer && (
          <div
            className="w-1.5 h-1.5 rounded-full flex-shrink-0 justify-self-center"
            style={{
              background: runningInstance ? '#3FB950' : '#E12E38',
              boxShadow: runningInstance ? '0 0 5px rgba(63,185,80,0.7)' : '0 0 4px rgba(225,46,56,0.5)',
              opacity: active ? 1 : 0,
              transition: `opacity 0.15s ease ${rowDelay}ms`,
            }}
            title={runningInstance ? 'Container running' : 'Container available'}
          />
        )}
      </div>
    </div>
  );
}

// -------- 中栏主面板 --------
function MainPanel({
  challenges, isLoading, isError,
  difficulty, result, active, instances, isAdmin, category,
  onDifficulty, onResult, onRowClick, onFilterOpen, onSwap,
}: {
  challenges: ChallengeByCategory[];
  isLoading: boolean;
  isError: boolean;
  difficulty: string;
  result: Result;
  active: boolean;
  instances: InstanceInfo[];
  isAdmin: boolean;
  category: string;
  onDifficulty: (d: string) => void;
  onResult: (r: Result) => void;
  onRowClick: (id: number) => void;
  onFilterOpen?: () => void;
  onSwap?: (id1: number, id2: number) => void;
}) {
  const [reorderMode, setReorderMode] = useState(false);
  const [localOrder, setLocalOrder] = useState<ChallengeByCategory[] | null>(null);
  const dragFromRef = useRef<number | null>(null);
  const dragToRef   = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const reorderModeRef = useRef(false);
  reorderModeRef.current = reorderMode;
  const listContainerRef = useRef<HTMLDivElement>(null);
  const touchFromHandleRef = useRef(false);
  const difficultyOptions = useMemo(
    () => buildDifficultyFilterOptions(challenges),
    [challenges],
  );

  const filtered = challenges.filter(ch => {
    if (
      normalizeDifficulty(difficulty) !== 'ALL'
      && normalizeDifficulty(ch.difficulty ?? '') !== normalizeDifficulty(difficulty)
    ) return false;
    if (result === 'SOLVED'   && ch.yourScore === 0) return false;
    if (result === 'UNSOLVED' && ch.yourScore  >  0) return false;
    return true;
  });

  useEffect(() => {
    const selectedDifficultyExists = difficultyOptions.some(
      option => option.value === normalizeDifficulty(difficulty),
    );
    if (!selectedDifficultyExists) onDifficulty('ALL');
  }, [difficulty, difficultyOptions, onDifficulty]);

  // 分类切换时退出 reorder 模式
  useEffect(() => {
    if (reorderModeRef.current) {
      setLocalOrder(null);
      setReorderMode(false);
      dragFromRef.current = null;
      dragToRef.current = null;
      setDragOverIndex(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  // 绑定非 passive 的 touchmove
  useEffect(() => {
    const el = listContainerRef.current;
    if (!el) return;
    const onTouchMove = (e: TouchEvent) => {
      if (!touchFromHandleRef.current) return;
      e.preventDefault();
      const touch = e.touches[0];
      const target = document.elementFromPoint(touch.clientX, touch.clientY);
      if (!target) return;
      const row = (target as HTMLElement).closest('[data-drag-index]') as HTMLElement | null;
      if (!row) return;
      const idx = parseInt(row.dataset.dragIndex ?? '', 10);
      if (!isNaN(idx) && idx !== dragToRef.current) {
        dragToRef.current = idx;
        setDragOverIndex(idx);
      }
    };
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => el.removeEventListener('touchmove', onTouchMove);
  }, []);

  function enterReorderMode() { setLocalOrder(filtered); setReorderMode(true); }
  function exitReorderMode() {
    setLocalOrder(null); setReorderMode(false);
    dragFromRef.current = null; dragToRef.current = null; setDragOverIndex(null);
  }

  const displayList = reorderMode && localOrder ? localOrder : filtered;
  const hasAnyContainer = displayList.some(ch => ch.configId !== -1 && ch.configId !== undefined);

  function handleDragStart(index: number) { dragFromRef.current = index; dragToRef.current = index; }
  function handleDragEnter(index: number) { dragToRef.current = index; setDragOverIndex(index); }
  async function handleDragEnd() {
    const from = dragFromRef.current;
    const to   = dragToRef.current;
    setDragOverIndex(null);
    dragFromRef.current = null;
    dragToRef.current = null;
    if (from === null || to === null || from === to || !onSwap || !localOrder) return;
    const next = [...localOrder];
    [next[from], next[to]] = [next[to], next[from]];
    setLocalOrder(next);
    await onSwap(localOrder[from].id, localOrder[to].id);
  }

  function handleTouchStart(e: React.TouchEvent, index: number) {
    e.stopPropagation();
    touchFromHandleRef.current = true;
    dragFromRef.current = index;
    dragToRef.current = index;
  }
  async function handleTouchEnd(e: React.TouchEvent) {
    e.stopPropagation();
    touchFromHandleRef.current = false;
    await handleDragEnd();
  }

  // 统计有容器的题目总数
  const containerCount = challenges.filter(ch => ch.configId !== -1 && ch.configId !== undefined).length;
  const activeContainers = instances.length;

  return (
    <div className="flex flex-col h-full">
      {/* 标题 */}
      <div className="px-5 py-5 border-b" style={{ borderColor: 'var(--ow-border)' }}>
        {/* 第一行：CHALLENGES 标题（独占，不参与按钮布局竞争） */}
        <GlitchText active={active} text="CHALLENGES" tag="h1"
          className="font-['Inter'] text-5xl font-light leading-none tracking-tight block"
          style={{ color: 'var(--ow-text)' }} duration={700} />

        {/* 第二行：按钮组 + 状态文字（始终在标题下方，永不与标题同行） */}
        <div className="flex items-center justify-between gap-2 mt-2 flex-wrap">
          <GlitchText active={active}
            text={reorderMode ? `REORDER MODE — DRAG ⠿ TO REARRANGE` : `DISPLAYING ${displayList.length} OF ${challenges.length} RECORDS`}
            className="ow-mono text-[10px] uppercase tracking-widest"
            style={{ color: reorderMode ? '#F5D700' : '#8A8A8A' }} />
          {/* 按钮组：移动端包含 FILTER，桌面端不含；位置始终在状态文字右侧 */}
          <div className="flex items-center gap-1">
            <button
              className="md:hidden px-3 py-1 border ow-mono text-[10px] uppercase tracking-widest transition-colors whitespace-nowrap"
              style={{ borderColor: 'var(--ow-border)', color: 'var(--ow-text-dim)' }}
              onClick={onFilterOpen}
            >
              [ FILTER ]
            </button>
            {isAdmin && onSwap && (
              <button
                onClick={() => reorderMode ? exitReorderMode() : enterReorderMode()}
                className="px-3 py-1 border ow-mono text-[10px] uppercase transition-colors whitespace-nowrap"
                style={{
                  borderColor: reorderMode ? '#F5D700' : '#2A2A2A',
                  color:       reorderMode ? '#F5D700' : '#555',
                  background:  reorderMode ? 'rgba(245,215,0,0.06)' : 'transparent',
                }}
              >
                {reorderMode ? '[ DONE ]' : '[ REORDER ]'}
              </button>
            )}
            {isAdmin && (
              <a href="/challenges/new"
                className="px-3 py-1 border ow-mono text-[10px] uppercase transition-colors whitespace-nowrap"
                style={{ borderColor: '#F5D700', color: '#F5D700' }}>
                [ + NEW ]
              </a>
            )}
          </div>
        </div>
      </div>

      {/* 筛选栏（上下两行 + 容器指示器，排序模式下隐藏） */}
      {!reorderMode && (
        <div className="px-5 py-3 border-b space-y-2" style={{ borderColor: 'var(--ow-border)' }}>
          {/* 第一行：DIFFI — 标签固定，按钮组横向滚动 */}
          <div className="flex items-center gap-2">
            <span className="ow-mono text-[9px] uppercase tracking-widest w-14 flex-shrink-0" style={{ color: 'var(--ow-text-muted)' }}>DIFFI</span>
            <div
              role="group"
              aria-label="Difficulty filters"
              className="flex gap-1 overflow-x-auto md:overflow-x-visible md:flex-wrap scrollbar-none flex-nowrap"
            >
              {difficultyOptions.map(option => {
                const selected = normalizeDifficulty(difficulty) === option.value;
                return (
                <button key={option.value} onClick={() => onDifficulty(option.value)}
                  aria-pressed={selected}
                  className="px-3 py-1 border ow-mono text-[11px] uppercase transition-colors flex-shrink-0"
                  style={{
                    borderColor: selected ? '#8A8A8A' : '#2A2A2A',
                    color:       selected ? '#F5F5F5' : '#555',
                    background:  selected ? 'rgba(255,255,255,0.04)' : 'transparent',
                  }}>
                  {option.label}
                </button>
                );
              })}
            </div>
          </div>
          {/* 第二行：RESULT — 标签固定，按钮组横向滚动；容器指示器跟随 */}
          <div className="flex items-center gap-2">
            <span className="ow-mono text-[9px] uppercase tracking-widest w-14 flex-shrink-0" style={{ color: 'var(--ow-text-muted)' }}>RESULT</span>
            <div className="flex gap-1 overflow-x-auto md:overflow-x-visible md:flex-wrap scrollbar-none flex-nowrap flex-1 min-w-0">
              {RESULTS.map(r => (
                <button key={r} onClick={() => onResult(r)}
                  className="px-3 py-1 border ow-mono text-[11px] uppercase transition-colors flex-shrink-0"
                  style={{
                    borderColor: result === r ? '#8A8A8A' : '#2A2A2A',
                    color:       result === r ? '#F5F5F5' : '#555',
                    background:  result === r ? 'rgba(255,255,255,0.04)' : 'transparent',
                  }}>
                  {r}
                </button>
              ))}
            </div>
            {/* 容器指示器（仅当本页有容器题时显示） */}
            {containerCount > 0 && (
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <div
                  className="w-1.5 h-1.5 rounded-full"
                  style={{
                    background: activeContainers > 0 ? '#3FB950' : '#555',
                    boxShadow: activeContainers > 0 ? '0 0 5px rgba(63,185,80,0.6)' : 'none',
                  }}
                />
                <span className="ow-mono text-[9px] uppercase tracking-widest" style={{ color: 'var(--ow-text-muted)' }}>
                  INST {activeContainers}/{containerCount}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 表头 */}
      <div
        className="flex items-center border-b"
        style={{ borderColor: 'var(--ow-border)', background: 'var(--ow-panel-bg-alt)' }}
      >
        {reorderMode && <div className="w-8 flex-shrink-0" />}
        <div
          className="flex-1 grid gap-2 md:gap-3 px-3 md:px-5 py-2"
          style={{ gridTemplateColumns: hasAnyContainer ? 'var(--cols-container)' : 'var(--cols-normal)' }}
        >
          <div className="ow-mono text-[9px] uppercase tracking-widest" style={{ color: 'var(--ow-text-muted)' }} />
          <div className="ow-mono text-[9px] uppercase tracking-widest hidden md:block" style={{ color: 'var(--ow-text-muted)' }}>CLASS</div>
          <div className="ow-mono text-[9px] uppercase tracking-widest" style={{ color: 'var(--ow-text-muted)' }}>DESIGNATION</div>
          <div className="ow-mono text-[9px] uppercase tracking-widest hidden md:block" style={{ color: 'var(--ow-text-muted)' }}>TAGS</div>
          <div className="ow-mono text-[9px] uppercase tracking-widest text-right" style={{ color: 'var(--ow-text-muted)' }}>CREDITS</div>
          {hasAnyContainer && <div className="ow-mono text-[9px] uppercase tracking-widest text-center" style={{ color: 'var(--ow-text-muted)' }}>INST</div>}
        </div>
      </div>

      {/* 列表 */}
      <div ref={listContainerRef} className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="flex items-center justify-center h-32">
            <span className="ow-mono text-[11px] uppercase tracking-widest" style={{ color: 'var(--ow-text-muted)' }}>
              &gt; Indexing records...
              <span className="inline-block w-[6px] h-[11px] ml-1 align-middle" style={{ background: 'var(--ow-text-muted)', animation: '1s step-end 0s infinite running ow-blink' }} />
            </span>
          </div>
        )}
        {isError && (
          <div className="flex items-center justify-center h-32">
            <span className="ow-mono text-[11px]" style={{ color: '#E12E38' }}>ERR: Failed to fetch — 请先登录</span>
          </div>
        )}
        {!isLoading && !isError && displayList.length === 0 && (
          <div className="flex items-center justify-center h-32">
            <span className="ow-mono text-[11px] uppercase tracking-widest" style={{ color: 'var(--ow-text-muted)' }}>NO RECORDS MATCH FILTER</span>
          </div>
        )}
        {displayList.map((ch, i) => (
          <div
            key={`${ch.id}-${ch.category}`}
            data-drag-index={reorderMode ? i : undefined}
            draggable={reorderMode}
            onDragStart={reorderMode ? () => handleDragStart(i) : undefined}
            onDragEnter={reorderMode ? (e) => { e.preventDefault(); handleDragEnter(i); } : undefined}
            onDragOver={reorderMode ? (e) => e.preventDefault() : undefined}
            onDragEnd={reorderMode ? handleDragEnd : undefined}
            style={{
              outline: reorderMode && dragOverIndex === i && dragFromRef.current !== i
                ? '1px solid #F5D700'
                : 'none',
            }}
          >
            <ChallengeRow
              ch={ch}
              index={i}
              active={active}
              instances={instances}
              isAdmin={isAdmin}
              reorderMode={reorderMode}
              isDragging={reorderMode && dragOverIndex === null && dragFromRef.current === i}
              dragHandleProps={reorderMode ? {
                onTouchStart: (e) => handleTouchStart(e, i),
                onTouchEnd:   handleTouchEnd,
              } : undefined}
              onClick={() => onRowClick(ch.id)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// -------- 页面内容（需要 useSearchParams）--------
function ChallengesPageContent() {
  const searchParams = useSearchParams();
  const { drawerToggle, allChallenges } = useChallengesLayout();
  const initialCat = searchParams.get('cat') ?? 'all';

  const [category, setCategory]     = useState(initialCat);
  const [difficulty, setDifficulty] = useState('ALL');
  const [result, setResult]         = useState<Result>('ALL');

  const { user, isAuthenticated } = useAuthStore();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [centerReady, setCenterReady] = useState(false);
  const onCenterDone = useCallback(() => setCenterReady(true), []);

  // searchParams 变化时同步 category（例如从左栏导航触发）
  useEffect(() => {
    const cat = searchParams.get('cat');
    if (cat) setCategory(cat);
  }, [searchParams]);

  const { data: challenges = [], isLoading, isError } = useQuery({
    queryKey: ['challenges', category],
    queryFn: () => getChallengesByCategory(category),
    retry: 1,
  });

  const { data: instances = [] } = useQuery({
    queryKey: ['instances'],
    queryFn: () => getMyInstances(),
    enabled: isAuthenticated,
    retry: 1,
    refetchInterval: 30000,
  });

  const handleSwap = useCallback(async (id1: number, id2: number) => {
    try {
      await swapChallenges(id1, id2);
      queryClient.invalidateQueries({ queryKey: ['challenges', category] });
      queryClient.invalidateQueries({ queryKey: ['challenges-all-stats'] });
    } catch { /* 静默失败 */ }
  }, [category, queryClient]);

  return (
    <PanelReveal
      delay={0}
      onComplete={onCenterDone}
      className="relative flex flex-col h-full overflow-hidden"
    >
      <MainPanel
        challenges={challenges}
        isLoading={isLoading}
        isError={isError}
        difficulty={difficulty}
        result={result}
        active={centerReady}
        instances={instances}
        isAdmin={((user?.role ?? 0) > 0)}
        category={category}
        onDifficulty={setDifficulty}
        onResult={setResult}
        onRowClick={(id) => router.push(`/challenges/${id}?from=${encodeURIComponent(category)}`)}
        onFilterOpen={drawerToggle}
        onSwap={((user?.role ?? 0) > 0) ? handleSwap : undefined}
      />
    </PanelReveal>
  );
}

export default function ChallengesPage() {
  return (
    <Suspense fallback={<div className="h-full" style={{ background: 'var(--ow-panel-bg-main)' }} />}>
      <ChallengesPageContent />
    </Suspense>
  );
}

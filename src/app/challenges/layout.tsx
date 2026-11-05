'use client';

import { useState, useCallback, useEffect, createContext, useContext } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Suspense } from 'react';
import { getChallengesByCategory } from '@/lib/api/challenge';
import { getScoreboardByDirection } from '@/lib/api/user';
import type { ChallengeByCategory } from '@/types/challenge';
import { PanelReveal } from '@/components/ow/PanelReveal';
import { GlitchText } from '@/components/ow/GlitchText';
import { useAuthStore } from '@/store/authStore';
import { SidebarDrawer } from '@/components/layout/SidebarDrawer';
import { useSidebarDrawer } from '@/hooks/useSidebarDrawer';
import Link from 'next/link';

// -------- Layout Context（传递给中栏子页面的共享状态）--------
interface ChallengesLayoutCtx {
  drawerToggle: () => void;
  activeCategory: string;
  allChallenges: ChallengeByCategory[];
}
const ChallengesLayoutContext = createContext<ChallengesLayoutCtx>({
  drawerToggle: () => {},
  activeCategory: 'all',
  allChallenges: [],
});
export function useChallengesLayout() {
  return useContext(ChallengesLayoutContext);
}

/**
 * challenges/ 共享布局
 *
 * 左栏（SYS_NAV）和右栏（LEADERBOARD）在 /challenges 和 /challenges/[id] 之间共享，
 * 路由切换时不重新挂载，动画不重播。
 * 中栏 {children} 由各子页面独立渲染。
 */

const CATEGORIES = [
  { key: 'all',        label: '[ ALL ]',     short: 'ALL'    },
  { key: 'web',        label: '[ WEB ]',     short: 'WEB'    },
  { key: 're',         label: '[ RE ]',      short: 'RE'     },
  { key: 'pwn',        label: '[ PWN ]',     short: 'PWN'    },
  { key: 'crypto',     label: '[ CRY ]',     short: 'CRY'    },
  { key: 'misc',       label: '[ MISC ]',    short: 'MISC'   },
  { key: 'dev',        label: '[ DEV ]',     short: 'DEV'    },
  { key: 'blockchain', label: '[ CHAIN ]',   short: 'CHAIN'  },
  { key: 'sa',         label: '[ SA ]',      short: 'SA'     },
  { key: 'design',     label: '[ DESIGN ]',  short: 'DESIGN' },
  { key: 'hpc',        label: '[ HPC ]',     short: 'HPC'    },
  { key: 'notice',     label: '[ NOTICE ]',  short: 'NOTICE' },
];

function rankColor(rank: number) {
  if (rank === 1) return '#F5D700';
  if (rank === 2) return '#C0C0C0';
  if (rank === 3) return '#CD7F32';
  return '#555';
}

// -------- 左栏 NavPanel --------
function NavPanel({
  allChallenges, activeCategory, onSelect, active, myRank, totalScore,
}: {
  allChallenges: ChallengeByCategory[];
  activeCategory: string;
  onSelect: (k: string) => void;
  active: boolean;
  myRank: number | null;
  totalScore: number;
}) {
  const solved = allChallenges.filter(c => c.yourScore > 0).length;
  const total  = allChallenges.length;

  return (
    <div className="flex flex-col h-full">
      {/* SYS_NAV 标题 */}
      <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--ow-border)' }}>
        <div className="flex items-center gap-3">
          <div className="w-3 h-3" style={{ background: 'var(--ow-text)' }} />
          <GlitchText active={active} text="SYS_NAV" className="font-bold text-[13px] tracking-widest" style={{ color: 'var(--ow-text)' }} />
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#3FB950', boxShadow: '0 0 6px rgba(63,185,80,0.5)' }} />
          <GlitchText active={active} text="LINK:OK" className="text-[9px] tracking-widest uppercase" style={{ color: 'var(--ow-text-muted)' }} />
        </div>
      </div>

      {/* 统计 */}
      <div className="px-5 py-4 border-b space-y-3" style={{ borderColor: 'var(--ow-border)' }}>
        <div>
          <GlitchText active={active} text="TOTAL_SCORE" className="text-[9px] uppercase tracking-widest block mb-1" style={{ color: 'var(--ow-text-muted)' }} />
          <GlitchText active={active} text={totalScore.toLocaleString()} className="font-['Inter'] text-2xl font-light" style={{ color: 'var(--ow-text)' }} duration={400} />
        </div>
        <div className="flex gap-4">
          <div>
            <GlitchText active={active} text="SOLVED" className="text-[9px] uppercase tracking-widest block mb-1" style={{ color: 'var(--ow-text-muted)' }} />
            <GlitchText active={active} text={`${solved}/${total}`} className="font-['Inter'] text-lg font-light" style={{ color: 'var(--ow-text)' }} duration={350} />
          </div>
          <div>
            <GlitchText active={active} text="RANK" className="text-[9px] uppercase tracking-widest block mb-1" style={{ color: 'var(--ow-text-muted)' }} />
            <GlitchText active={active} text={myRank ? `#${myRank}` : '—'} className="font-['Inter'] text-lg font-light" style={{ color: myRank ? '#F5D700' : '#555' }} duration={350} />
          </div>
        </div>
      </div>

      {/* 分类导航 */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <GlitchText active={active} text="DIRECTORIES" className="text-[9px] uppercase tracking-widest block mb-3" style={{ color: 'var(--ow-text-muted)' }} />
        <ul className="space-y-0.5">
          {CATEGORIES.map((cat, i) => {
            const catItems = cat.key === 'all'
              ? allChallenges
              : allChallenges.filter(c => c.category?.toLowerCase() === cat.key);
            const catSolved = catItems.filter(c => c.yourScore > 0).length;
            const isActive = activeCategory === cat.key;
            return (
              <li key={cat.key}>
                <button
                  onClick={() => onSelect(cat.key)}
                  className="w-full flex items-center justify-between py-1 transition-colors duration-100 text-left"
                  style={{ color: isActive ? '#F5F5F5' : '#555' }}
                >
                  <GlitchText
                    active={active}
                    text={cat.label}
                    duration={300 + i * 30}
                    className="ow-mono text-[14px]"
                    style={{ color: isActive ? '#F5F5F5' : '#555' }}
                  />
                  <span className="ow-mono text-[12px]" style={{ color: isActive ? '#8A8A8A' : '#333' }}>
                    {catItems.length > 0 ? `${catSolved}/${catItems.length}` : '—'}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

// -------- 右栏 LeaderboardPanel --------
function LeaderboardPanel({ active }: { active: boolean }) {
  const { data: rankings = [], isLoading } = useQuery({
    queryKey: ['scoreboard', 'active'],
    queryFn: () => getScoreboardByDirection(0),
    retry: 1,
  });

  const top10 = rankings.slice(0, 10);

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-4 border-b" style={{ borderColor: 'var(--ow-border)' }}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <GlitchText active={active} text="LEADERBOARD" tag="h2"
              className="font-['Inter'] text-xl font-light leading-none tracking-tight block"
              style={{ color: 'var(--ow-text)' }} duration={600} />
            <GlitchText active={active} text={`TOP ${top10.length} OPERATORS`}
              className="ow-mono text-[9px] uppercase tracking-widest mt-0.5"
              style={{ color: 'var(--ow-text-muted)' }} />
          </div>
          {/* 详情入口 */}
          <Link
            href="/leaderboard"
            className="flex-shrink-0 mt-0.5 p-1 transition-opacity opacity-40 hover:opacity-100"
            title="查看完整排行榜"
            aria-label="查看完整排行榜"
          >
            {/* 外部链接 / 展开图标 */}
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" style={{ color: 'var(--ow-text-dim)' }}>
              <rect x="1" y="4" width="9" height="9" rx="0.5" />
              <path d="M6 1h7v7" />
              <path d="M13 1L6 8" />
            </svg>
          </Link>
        </div>
      </div>

      {/* 表头 */}
      <div className="flex items-center gap-3 px-4 py-1.5 border-b" style={{ borderColor: 'var(--ow-border)', background: 'var(--ow-panel-bg-alt)' }}>
        <span className="ow-mono text-[9px] uppercase tracking-widest w-6 text-center flex-shrink-0" style={{ color: 'var(--ow-text-muted)' }}>RNK</span>
        <span className="ow-mono text-[9px] uppercase tracking-widest flex-1" style={{ color: 'var(--ow-text-muted)' }}>NAME</span>
        <span className="ow-mono text-[9px] uppercase tracking-widest flex-shrink-0" style={{ color: 'var(--ow-text-muted)' }}>SCORE</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-24">
            <span className="ow-mono text-[10px]" style={{ color: 'var(--ow-text-muted)' }}>loading...</span>
          </div>
        ) : top10.map((entry, i) => (
          <div
            key={entry.username}
            className="flex items-center gap-3 px-4 py-2.5 border-b border-l-2 transition-colors"
            style={{
              borderBottomColor: '#1A1A1A',
              borderLeftColor: entry.rank <= 3 ? rankColor(entry.rank) : 'transparent',
              opacity: active ? 1 : 0,
              transition: `opacity 0.15s ease ${i * 60}ms`,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.015)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <GlitchText
              active={active}
              text={String(entry.rank).padStart(2, '0')}
              duration={150 + i * 20}
              className="ow-mono text-[11px] font-bold w-6 text-center flex-shrink-0"
              style={{ color: rankColor(entry.rank) }}
            />
            <GlitchText
              active={active}
              text={entry.username}
              duration={350 + i * 25}
              className="ow-mono text-[11px] font-light truncate flex-1 block"
              style={{ color: 'var(--ow-text-mid)' }}
            />
            <GlitchText
              active={active}
              text={entry.score.toLocaleString()}
              duration={200 + i * 20}
              className="ow-mono text-[11px] flex-shrink-0"
              style={{ color: entry.rank <= 3 ? rankColor(entry.rank) : '#555' }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// -------- 布局内容（需要 useSearchParams，包在 Suspense 里）--------
function ChallengesLayoutContent({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const searchParams = useSearchParams();

  // 当前激活的分类：从 URL ?cat= 读取，详情页从 ?from= 读取
  const [activeCategory, setActiveCategory] = useState(() => {
    return searchParams.get('cat') ?? searchParams.get('from') ?? 'all';
  });

  // URL 变化时同步 activeCategory（例如从详情页返回列表页时）
  useEffect(() => {
    const cat  = searchParams.get('cat');
    const from = searchParams.get('from');
    const next = cat ?? from ?? 'all';
    setActiveCategory(next);
  }, [searchParams]);

  const drawer = useSidebarDrawer();

  // 全量题目（统计 + 左栏分类计数）
  const { data: allChallenges = [] } = useQuery({
    queryKey: ['challenges-all-stats'],
    queryFn: () => getChallengesByCategory('all'),
    retry: 1,
  });

  // 排行榜（计算当前用户排名）
  const { data: rankings = [] } = useQuery({
    queryKey: ['scoreboard', 'active'],
    queryFn: () => getScoreboardByDirection(0),
    retry: 1,
  });

  const { user } = useAuthStore();
  const totalScore = allChallenges.reduce((sum, c) => sum + (c.yourScore ?? 0), 0);
  const myRank = user
    ? (rankings.find(r => r.username === user.username)?.rank ?? null)
    : null;

  const [leftReady,  setLeftReady]  = useState(false);
  const [rightReady, setRightReady] = useState(false);
  const onLeftDone  = useCallback(() => setLeftReady(true),  []);
  const onRightDone = useCallback(() => setRightReady(true), []);

  function handleCategorySelect(key: string) {
    setActiveCategory(key);
    // 无论在列表页还是详情页，选分类都跳到列表页
    router.push(`/challenges?cat=${encodeURIComponent(key)}`);
  }

  const panelBase  = 'relative flex flex-col overflow-hidden';
  const panelStyle = { background: 'var(--ow-panel-bg-main)' };

  return (
    <div
      className="flex min-h-[calc(100dvh-3rem)] p-3 md:p-4 gap-3 md:gap-4"
      style={{ background: 'var(--ow-bg)' }}
    >
      {/* 左栏 — 桌面端内联，移动端通过抽屉 */}
      <PanelReveal
        delay={0}
        onComplete={onLeftDone}
        className={`${panelBase} w-[240px] xl:w-[280px] flex-shrink-0 hidden md:flex`}
        style={panelStyle}
      >
        <NavPanel
          allChallenges={allChallenges}
          activeCategory={activeCategory}
          onSelect={handleCategorySelect}
          active={leftReady}
          myRank={myRank}
          totalScore={totalScore}
        />
      </PanelReveal>

      {/* 移动端抽屉 */}
      <SidebarDrawer open={drawer.open} onClose={drawer.close}>
        <NavPanel
          allChallenges={allChallenges}
          activeCategory={activeCategory}
          onSelect={(k) => { handleCategorySelect(k); drawer.close(); }}
          active={true}
          myRank={myRank}
          totalScore={totalScore}
        />
      </SidebarDrawer>

      {/* 中栏：由子页面渲染，通过 context 传递 drawer.toggle 和 activeCategory */}
      {/* overflow-visible 必须保留，否则 PanelReveal 的 corner 高亮会被裁切 */}
      <ChallengesLayoutContext.Provider value={{ drawerToggle: drawer.toggle, activeCategory, allChallenges }}>
        <div className="relative flex flex-col flex-1 min-w-0 overflow-visible" style={panelStyle}>
          {children}
        </div>
      </ChallengesLayoutContext.Provider>

      {/* 右栏 */}
      <PanelReveal
        delay={0}
        onComplete={onRightDone}
        className={`${panelBase} w-[220px] xl:w-[280px] flex-shrink-0 hidden lg:flex`}
        style={panelStyle}
      >
        <LeaderboardPanel active={rightReady} />
      </PanelReveal>
    </div>
  );
}

// -------- 默认导出（Next.js Layout）--------
export default function ChallengesLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen" style={{ background: 'var(--ow-bg)' }} />}>
      <ChallengesLayoutContent>{children}</ChallengesLayoutContent>
    </Suspense>
  );
}

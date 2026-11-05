'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useInfiniteQuery, useQuery, useQueries, keepPreviousData } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { getScoreboardByDirection, getAchievements, type RankedEntry } from '@/lib/api/user';
import { useAuthStore } from '@/store/authStore';
import { PanelReveal } from '@/components/ow/PanelReveal';
import { GlitchText } from '@/components/ow/GlitchText';

/* ─── 常量 ──────────────────────────────────────────────── */

const PAGE_SIZE = 50;

// userGroup 值：-1 = 全部（不过滤），0 = ACTIVE（应届），1 = VETERAN（学长），
// 2 = EXTERNAL（外校），4 = OBSERVER（旁观）
const USER_GROUPS = [
  { key: 0,  label: 'ACTIVE',   desc: '应届' },
  { key: -1, label: 'ALL',      desc: '全部' },
  { key: 1,  label: 'VETERAN',  desc: '学长' },
  { key: 2,  label: 'EXTERNAL', desc: '外校' },
  { key: 4,  label: 'OBSERVER', desc: '旁观' },
];

const CATEGORIES = [
  { key: 'All',        label: 'ALL'    },
  { key: 'web',        label: 'WEB'    },
  { key: 'pwn',        label: 'PWN'    },
  { key: 're',         label: 'RE'     },
  { key: 'misc',       label: 'MISC'   },
  { key: 'crypto',     label: 'CRYPTO' },
  { key: 'sa',         label: 'SA'     },
  { key: 'dev',        label: 'DEV'    },
  { key: 'blockchain', label: 'CHAIN'  },
  { key: 'design',     label: 'DESIGN' },
  { key: 'hpc',        label: 'HPC'    },
];

const CAT_COLORS: Record<string, string> = {
  web:        '#3FB950',
  pwn:        '#E12E38',
  re:         '#FF6200',
  misc:       '#8B5CF6',
  crypto:     '#F5D700',
  sa:         '#38BDF8',
  dev:        '#34D399',
  blockchain: '#FB923C',
  design:     '#F472B6',
  hpc:        '#A3E635',
};

function rankColor(rank: number) {
  if (rank === 1) return '#F5D700';
  if (rank === 2) return '#C0C0C0';
  if (rank === 3) return '#CD7F32';
  return '#555555';
}

/* ─── Stacked Mini Bar ───────────────────────────────────── */

function StackedBar({
  scoreList, totalScore, maxScore,
}: {
  scoreList: Array<{ category: string; score: number }>;
  totalScore: number;
  maxScore: number;
}) {
  if (maxScore === 0) return null;
  const widthPct = Math.max((totalScore / maxScore) * 100, 2);
  const segments = scoreList.filter(s => s.score > 0);

  return (
    <div className="flex items-center min-w-0">
      <div
        className="h-[5px] flex overflow-hidden"
        style={{ width: `${widthPct}%`, maxWidth: '100%', background: 'var(--ow-border)' }}
      >
        {segments.map(s => (
          <div
            key={s.category}
            style={{
              width: `${(s.score / totalScore) * 100}%`,
              background: CAT_COLORS[s.category] ?? '#555',
              flexShrink: 0,
            }}
          />
        ))}
      </div>
    </div>
  );
}

/* ─── Podium ─────────────────────────────────────────────── */

function Podium({ top3, active }: { top3: RankedEntry[]; active: boolean }) {
  if (top3.length < 1) return null;
  // 顺序：2nd 左，1st 中，3rd 右
  const display = [top3[1], top3[0], top3[2]];
  const platformH = ['2.5rem', '4rem', '1.5rem'];
  const ranks = [2, 1, 3];

  return (
    <div className="px-3 md:px-6 py-5 border-b flex items-end justify-center gap-4"
      style={{ borderColor: 'var(--ow-border)' }}>
      {display.map((entry, idx) => {
        if (!entry) return <div key={idx} style={{ minWidth: '5.5rem' }} />;
        const rank  = ranks[idx];
        const color = rankColor(rank);
        return (
          <motion.div
            key={entry.username}
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 + idx * 0.07, duration: 0.25 }}
            className="flex flex-col items-center gap-1"
            style={{ minWidth: '5.5rem' }}
          >
            <div className="ow-mono text-[10px] tracking-widest truncate max-w-[5.5rem] text-center"
              style={{ color: 'var(--ow-text-dim)' }}>
              <GlitchText active={active} text={entry.username} duration={300 + idx * 80} />
            </div>
            <div className="ow-mono text-[11px]" style={{ color }}>
              <GlitchText active={active} text={entry.score.toLocaleString()} duration={350} />
            </div>
            <div
              className="w-full flex items-center justify-center ow-mono text-[18px] font-bold border-t-2"
              style={{ height: platformH[idx], borderColor: color, color, background: `${color}0D` }}
            >
              {String(rank).padStart(2, '0')}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

/* ─── Tab Button ─────────────────────────────────────────── */

function TabBtn({ active, label, onClick, glitchActive }: {
  active: boolean;
  label: string;
  onClick: () => void;
  glitchActive: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1 border ow-mono text-[11px] uppercase transition-colors whitespace-nowrap shrink-0"
      style={{
        borderColor: active ? '#8A8A8A' : '#2A2A2A',
        color:       active ? '#F5F5F5' : '#555',
        background:  active ? 'rgba(255,255,255,0.04)' : 'transparent',
      }}
    >
      <GlitchText active={glitchActive} text={label} duration={300} />
    </button>
  );
}

/* ─── Rank Row ───────────────────────────────────────────── */

function RankRow({
  entry, index, isSelf, maxScore, showBar, expanded, onToggle, listActive,
}: {
  entry: RankedEntry;
  index: number;
  isSelf: boolean;
  maxScore: number;
  showBar: boolean;
  expanded: boolean;
  onToggle: () => void;
  listActive: boolean;
}) {
  const isTop3  = entry.rank <= 3;
  const color   = rankColor(entry.rank);
  const selfBg  = isSelf ? 'rgba(63,185,80,0.04)' : 'transparent';
  const detailCats = entry.scoreList.filter(s => s.score > 0);

  // 懒加载该用户的成就（只有展开 && 有 userId 时才请求）
  const { data: achievements = [] } = useQuery({
    queryKey: ['achievements', entry.userId],
    queryFn: () => getAchievements(entry.userId!),
    enabled: expanded && !!entry.userId,
    retry: 1,
    staleTime: 60_000,
  });

  // 成就 GlitchText 触发时机：
  // 展开后需等外层 (0.2s) + 内层 achievements section (0.25s) 动画走完
  // 延迟 350ms 触发，关闭时立即重置以便下次重播
  const [achievementsActive, setAchievementsActive] = useState(false);
  const achieveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    if (expanded && achievements.length > 0) {
      achieveTimerRef.current = setTimeout(() => setAchievementsActive(true), 100);
    } else {
      clearTimeout(achieveTimerRef.current);
      setAchievementsActive(false);
    }
    return () => clearTimeout(achieveTimerRef.current);
  }, [expanded, achievements.length]);

  return (
    <div>
      <motion.div
        initial={false}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: Math.min(index * 0.015, 0.35), duration: 0.15 }}
        className="grid gap-3 px-3 md:px-6 py-3 border-b items-center border-l-2 cursor-pointer select-none"
        style={{
          gridTemplateColumns: showBar ? '3rem 1fr 1fr 5.5rem' : '3rem 1fr 5.5rem',
          borderBottomColor: '#1A1A1A',
          borderLeftColor: isSelf ? '#3FB950' : isTop3 ? color : 'transparent',
          background: selfBg,
          transition: 'background 0.1s',
        }}
        onClick={onToggle}
        onMouseEnter={e => { if (!isSelf) e.currentTarget.style.background = 'rgba(255,255,255,0.015)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = selfBg; }}
      >
        {/* 名次 */}
        <div className="ow-mono text-sm font-bold text-center" style={{ color }}>
          <GlitchText
            active={listActive}
            text={String(entry.rank).padStart(2, '0')}
            duration={200 + index * 10}
          />
        </div>
        {/* 用户名 */}
        <div className="ow-mono text-[12px] truncate" style={{ color: isSelf ? '#3FB950' : '#BFBFBF' }}>
          <GlitchText
            active={listActive}
            text={isSelf ? `★ ${entry.username}` : entry.username}
            duration={250 + index * 12}
          />
        </div>
        {/* Breakdown bar */}
        {showBar && (
          <div className="min-w-0">
            <StackedBar scoreList={entry.scoreList} totalScore={entry.score} maxScore={maxScore} />
          </div>
        )}
        {/* 分数 */}
        <div className="ow-mono text-sm text-right" style={{ color: isTop3 ? color : '#8A8A8A' }}>
          <GlitchText
            active={listActive}
            text={entry.score.toLocaleString()}
            duration={220 + index * 10}
          />
        </div>
      </motion.div>

      <AnimatePresence initial={false}>
        {expanded && (detailCats.length > 0 || achievements.length > 0) && (
          <motion.div
            key="detail"
            initial={false}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            style={{ overflow: 'hidden', borderBottom: '1px solid #1A1A1A' }}
          >
            <div
              className="px-3 md:px-6 py-3 grid gap-x-4 gap-y-2"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(7rem, 1fr))', background: 'rgba(255,255,255,0.012)' }}
            >
              {detailCats.map(s => (
                <div key={s.category} className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 shrink-0" style={{ background: CAT_COLORS[s.category] ?? '#555' }} />
                  <span className="ow-mono text-[10px] uppercase" style={{ color: 'var(--ow-text-muted)' }}>{s.category}</span>
                  <span className="ow-mono text-[10px] ml-auto" style={{ color: 'var(--ow-text-dim)' }}>{s.score.toLocaleString()}</span>
                </div>
              ))}
            </div>
            {/* 成就 tags — 自身做 height 0→auto 动画，避免异步到来时外层高度跳变 */}
            <AnimatePresence>
              {achievements.length > 0 && (
                <motion.div
                  key="achievements-section"
                  initial={false}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                  style={{ overflow: 'hidden', background: 'rgba(255,255,255,0.012)', borderTop: '1px solid #1A1A1A' }}
                >
                  <div className="px-3 md:px-6 pb-3 pt-2 flex flex-wrap gap-2">
                    <span className="ow-mono text-[9px] uppercase tracking-widest w-full" style={{ color: 'var(--ow-text-muted)' }}>
                      ACHIEVEMENTS
                    </span>
                    {achievements.map((a, i) => (
                      <div
                        key={a.key}
                        title={a.description + (a.unlockedAt ? " · " + new Date(a.unlockedAt).toLocaleString() : "")}
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 border ow-mono text-[10px] uppercase tracking-widest"
                        style={{
                          borderColor: a.color,
                          color: a.color,
                          background: `${a.color}18`,
                        }}
                      >
                        <div className="w-1 h-1 shrink-0" style={{ background: a.color }} />
                        <GlitchText
                          active={achievementsActive}
                          text={(a.icon ? a.icon + " " : "") + a.label}
                          duration={200 + i * 40}
                        />
                        <span className="normal-case text-[9px]">{a.description}</span>
                        {a.unlockedAt && <time dateTime={a.unlockedAt} className="text-[9px]">{new Date(a.unlockedAt).toLocaleDateString()}</time>}
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────── */

export default function LeaderboardPage() {
  // 默认选应届（usergroup=0）
  const [group,    setGroup]    = useState<number>(0);
  const [category, setCategory] = useState<string>('All');
  const [search,   setSearch]   = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [panelReady, setPanelReady] = useState(false);

  const currentUser = useAuthStore(s => s.user);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const onPanelComplete = useCallback(() => setPanelReady(true), []);

  // listActive：控制列表行的 GlitchText 和 bar 动画
  // 必须等 panelReady（panel 展开完毕）AND 有数据之后才触发
  // 切换 tab 时先 false，新数据到位后再 true
  const [listActive, setListActive] = useState(false);
  const listTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // useInfiniteQuery — 无限滚动分页
  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetching,
  } = useInfiniteQuery({
    queryKey: ['leaderboard', group, category],
    queryFn: ({ pageParam = 0 }) =>
      getScoreboardByDirection(group, category, PAGE_SIZE, pageParam as number),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length === PAGE_SIZE) return allPages.length * PAGE_SIZE;
      return undefined;
    },
    placeholderData: keepPreviousData,
    retry: 1,
  });

  // 切换 group/category 时立即关掉动画，等新数据 + panel ready 后重启
  useEffect(() => {
    setListActive(false);
  }, [group, category]);

  // 当 panel 已展开 且 数据就位（不再 fetching 第一页）时触发动画
  // 80ms 延迟让 fade transition 先走一步
  const hasData = !!data && !isLoading;
  useEffect(() => {
    if (!panelReady || !hasData) return;
    clearTimeout(listTimerRef.current);
    listTimerRef.current = setTimeout(() => setListActive(true), 80);
    return () => clearTimeout(listTimerRef.current);
  }, [panelReady, hasData, group, category]);

  // 展平所有页数据
  const allEntries: RankedEntry[] = data?.pages.flat() ?? [];

  // 预拉取所有可见用户的成就，结果写入 React Query 缓存
  // RankRow 展开时 useQuery 直接命中缓存，无需等待网络请求
  useQueries({
    queries: allEntries
      .filter(e => e.userId != null)
      .map(e => ({
        queryKey: ['achievements', e.userId],
        queryFn: () => getAchievements(e.userId!),
        staleTime: 60_000,
        retry: 1,
      })),
  });

  // 本地搜索过滤
  const filtered = search.trim()
    ? allEntries.filter(r => r.username.toLowerCase().includes(search.toLowerCase()))
    : allEntries;

  const maxScore = allEntries[0]?.score ?? 0;
  const showBar  = category === 'All';
  const top3     = allEntries.slice(0, 3);

  // IntersectionObserver — 滚动到底部触发加载
  useEffect(() => {
    if (!loadMoreRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleToggle = useCallback((username: string) => {
    setExpanded(prev => prev === username ? null : username);
  }, []);

  const handleGroupChange = useCallback((key: number) => {
    setGroup(key);
    setExpanded(null);
  }, []);

  const handleCategoryChange = useCallback((key: string) => {
    setCategory(key);
    setExpanded(null);
  }, []);

  return (
    <div
      className="flex min-h-[calc(100dvh-3rem)] p-3 md:p-4 justify-center"
      style={{ background: 'var(--ow-bg)' }}
    >
      <PanelReveal
        delay={0}
        onComplete={onPanelComplete}
        className="relative flex flex-col w-full max-w-3xl overflow-hidden"
        style={{ background: 'var(--ow-panel-bg-main)' }}
      >
        {/* ── 标题 ── */}
        <div className="px-3 md:px-6 py-5 border-b" style={{ borderColor: 'var(--ow-border)' }}>
          <h1 className="font-['Inter'] text-[46px] font-light leading-none tracking-tight"
            style={{ color: 'var(--ow-text)' }}>
            <GlitchText active={panelReady} text="LEADERBOARD" duration={500} />
          </h1>
          <div className="flex items-center justify-between mt-1">
            <p className="ow-mono text-[11px] uppercase tracking-widest" style={{ color: 'var(--ow-text-dim)' }}>
              <GlitchText
                active={panelReady}
                text={`DISPLAYING ${filtered.length} / ${allEntries.length} RECORDS`}
                duration={400}
              />
            </p>
            {category !== 'All' && (
              <p className="ow-mono text-[11px] uppercase tracking-widest" style={{ color: 'var(--ow-text-muted)' }}>
                DIR: {category.toUpperCase()}
              </p>
            )}
          </div>
        </div>

        {/* ── 搜索框 ── */}
        <div className="px-3 md:px-6 py-3 border-b" style={{ borderColor: 'var(--ow-border)' }}>
          <div className="flex items-center gap-2">
            <span className="ow-mono text-[11px]" style={{ color: 'var(--ow-text-muted)' }}>&gt;</span>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="SEARCH OPERATOR"
              className="flex-1 bg-transparent outline-none ow-mono text-[12px] uppercase placeholder:text-[#333] tracking-widest"
              style={{ color: 'var(--ow-text)', caretColor: '#3FB950' }}
              spellCheck={false}
            />
            {search && (
              <button onClick={() => setSearch('')} className="ow-mono text-[10px]" style={{ color: 'var(--ow-text-muted)' }}>
                [CLR]
              </button>
            )}
          </div>
        </div>

        {/* ── 双维度 Tab ── */}
        <div className="border-b" style={{ borderColor: 'var(--ow-border)' }}>
          {/* GROUP */}
          <div className="px-3 md:px-6 py-2 flex gap-2 items-center border-b" style={{ borderColor: 'var(--ow-border)' }}>
            <span className="ow-mono text-[9px] uppercase tracking-widest shrink-0"
              style={{ color: 'var(--ow-text-muted)', minWidth: '3rem' }}>
              GROUP
            </span>
            <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
              {USER_GROUPS.map(g => (
                <TabBtn
                  key={g.key}
                  active={group === g.key}
                  label={g.label}
                  onClick={() => handleGroupChange(g.key)}
                  glitchActive={panelReady}
                />
              ))}
            </div>
          </div>
          {/* DIR */}
          <div className="px-3 md:px-6 py-2 flex gap-2 items-center">
            <span className="ow-mono text-[9px] uppercase tracking-widest shrink-0"
              style={{ color: 'var(--ow-text-muted)', minWidth: '3rem' }}>
              DIR
            </span>
            <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
              {CATEGORIES.map(c => (
                <TabBtn
                  key={c.key}
                  active={category === c.key}
                  label={c.label}
                  onClick={() => handleCategoryChange(c.key)}
                  glitchActive={panelReady}
                />
              ))}
            </div>
          </div>
        </div>

        {/* ── Podium（无搜索时展示） ── */}
        {!search && !isLoading && !isError && top3.length > 0 && (
          <Podium top3={top3} active={panelReady} />
        )}

        {/* ── 表头 ── */}
        <div
          className="grid gap-3 px-3 md:px-6 py-2 border-b shrink-0"
          style={{
            gridTemplateColumns: showBar ? '3rem 1fr 1fr 5.5rem' : '3rem 1fr 5.5rem',
            borderColor: 'var(--ow-border)',
            background: 'var(--ow-panel-bg-alt)',
          }}
        >
          {(showBar
            ? ['RANK', 'OPERATOR', 'BREAKDOWN', 'SCORE']
            : ['RANK', 'OPERATOR', 'SCORE']
          ).map((h, i) => (
            <div key={h}
              className={`ow-mono text-[9px] uppercase tracking-widest ${i === (showBar ? 3 : 2) ? 'text-right' : ''}`}
              style={{ color: 'var(--ow-text-muted)' }}>
              <GlitchText active={panelReady} text={h} duration={300 + i * 50} />
            </div>
          ))}
        </div>

        {/* ── 列表区域：overflow-y:scroll 始终占住 scrollbar 位置，防晃动 ── */}
        <div className="flex-1" style={{ overflowY: 'scroll' }}>
          {/* 切换 tab 时整体淡出淡入，避免闪烁 */}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`${group}:${category}`}
              initial={false}
              animate={{ opacity: isFetching && !isFetchingNextPage ? 0.4 : 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {isLoading && (
                <div className="flex items-center justify-center h-40">
                  <span className="ow-mono text-[11px] uppercase tracking-widest" style={{ color: 'var(--ow-text-muted)' }}>
                    &gt; Indexing records...
                  </span>
                </div>
              )}
              {isError && (
                <div className="flex items-center justify-center h-40">
                  <span className="ow-mono text-[11px]" style={{ color: '#E12E38' }}>
                    ERR: Failed to fetch — 请先登录
                  </span>
                </div>
              )}
              {!isLoading && !isError && filtered.length === 0 && (
                <div className="flex items-center justify-center h-40">
                  <span className="ow-mono text-[11px] uppercase tracking-widest" style={{ color: 'var(--ow-text-muted)' }}>
                    {search ? 'NO MATCH' : 'NO RECORDS'}
                  </span>
                </div>
              )}

              {filtered.map((entry, i) => (
                <RankRow
                  key={entry.username}
                  entry={entry}
                  index={i}
                  isSelf={!!(currentUser && currentUser.username === entry.username)}
                  maxScore={maxScore}
                  showBar={showBar}
                  expanded={expanded === entry.username}
                  onToggle={() => handleToggle(entry.username)}
                  listActive={listActive}
                />
              ))}

              {/* 加载触发器 & 状态提示（搜索时不显示） */}
              {!search && (
                <div ref={loadMoreRef} className="flex items-center justify-center py-4">
                  {isFetchingNextPage && (
                    <span className="ow-mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--ow-text-muted)' }}>
                      &gt; Loading...
                    </span>
                  )}
                  {!hasNextPage && allEntries.length > 0 && (
                    <span className="ow-mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--ow-text)' }}>
                      — END OF RECORDS —
                    </span>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </PanelReveal>
    </div>
  );
}

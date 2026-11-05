'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';
import { getSolvedChallenges, getScoreboardByDirection, getScoreHistory, getAchievements } from '@/lib/api/user';
import type { RankedEntry, ScoreHistoryEntry } from '@/lib/api/user';
import type { Achievement } from '@/types/user';
import { PanelReveal } from '@/components/ow/PanelReveal';
import { GlitchText } from '@/components/ow/GlitchText';
import { SidebarDrawer } from '@/components/layout/SidebarDrawer';
import { useSidebarDrawer } from '@/hooks/useSidebarDrawer';

/**
 * Profile 页 — 三栏 Overwatch 面板布局
 *
 * ┌──────────────┬──────────────────────────┬─────────────────┐
 * │  左栏        │  中栏                    │  右栏上         │
 * │  SYS_NAV     │  用户名 + 信息           │  LATEST_OPS     │
 * │  总分/完成/排名│  折线图                  ├─────────────────┤
 * │  分类导航    │                          │  右栏下         │
 * │              │                          │  FAQ            │
 * └──────────────┴──────────────────────────┴─────────────────┘
 */

// 分类颜色（折线图 + 标签）
const CAT_COLORS: Record<string, string> = {
  web:        '#3FB950',
  pwn:        '#E12E38',
  crypto:     '#F5D700',
  re:         '#FF6200',
  misc:       '#8A8A8A',
  dev:        '#58A6FF',
  design:     '#BFBFBF',
  blockchain: '#A371F7',
  sa:         '#79C0FF',
  hpc:        '#D2A8FF',
  notice:     '#555',
};

function catColor(c: string) {
  return CAT_COLORS[c?.toLowerCase()] ?? '#555';
}

const CATEGORIES = [
  { key: 'all',        label: '[ ALL ]'    },
  { key: 'web',        label: '[ WEB ]'    },
  { key: 're',         label: '[ RE ]'     },
  { key: 'pwn',        label: '[ PWN ]'    },
  { key: 'crypto',     label: '[ CRY ]'    },
  { key: 'misc',       label: '[ MISC ]'   },
  { key: 'dev',        label: '[ DEV ]'    },
  { key: 'blockchain', label: '[ CHAIN ]'  },
  { key: 'sa',         label: '[ SA ]'     },
  { key: 'design',     label: '[ DESIGN ]' },
  { key: 'hpc',        label: '[ HPC ]'    },
];

// userGroup 映射为状态标签
function statusLabel(userGroup: number, isAdmin: boolean) {
  if (isAdmin) return 'ADMIN';
  switch (userGroup) {
    case 0:  return 'ACTIVE';
    case 1:  return 'VETERAN';
    case 2:  return 'EXTERNAL';
    case 4:  return 'OBSERVER';
    default: return 'ACTIVE';
  }
}

// ─────────── SVG 折线图 ───────────
interface ChartProps {
  history: ScoreHistoryEntry[];
  active: boolean;
}

function ScoreLineChart({ history, active }: ChartProps) {
  const W = 100; // viewBox 宽度（百分比单位）
  const H = 60;  // viewBox 高度
  const PAD = { top: 6, right: 4, bottom: 14, left: 24 };

  // 计算每个分类的累积分数时间序列
  const series = useMemo(() => {
    if (!history.length) return [];

    // 收集所有日期（排序去重）
    const allDates = [...new Set(history.map(e => e.date))].sort();
    // 收集所有分类（排除 notice）
    const allCats = [...new Set(history.map(e => e.category))]
      .filter(c => c !== 'notice')
      .sort();

    // 每个分类的累积分
    return allCats.map(cat => {
      let cum = 0;
      const points = allDates.map(date => {
        const entry = history.find(e => e.date === date && e.category === cat);
        if (entry) cum += entry.dailyScore;
        return { date, value: cum };
      });
      // 只保留有分数的系列
      if (cum === 0) return null;
      return { cat, points };
    }).filter(Boolean) as { cat: string; points: { date: string; value: number }[] }[];
  }, [history]);

  if (!active || !series.length) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="ow-mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--ow-text-muted)' }}>
          {active ? 'NO_DATA' : ''}
        </span>
      </div>
    );
  }

  // 所有数据点的最大值（用于 Y 轴缩放）
  const maxVal = Math.max(...series.flatMap(s => s.points.map(p => p.value)), 1);
  // 所有日期
  const allDates = [...new Set(history.map(e => e.date))].sort();
  const n = allDates.length;

  // 坐标映射
  const xOf = (i: number) =>
    PAD.left + (i / Math.max(n - 1, 1)) * (W - PAD.left - PAD.right);
  const yOf = (v: number) =>
    PAD.top + (1 - v / maxVal) * (H - PAD.top - PAD.bottom);

  // Y 轴刻度（3条）
  const yTicks = [0, Math.round(maxVal / 2), maxVal];

  // 最新日期用于 X 轴右端标签
  const firstDate = allDates[0]?.slice(5) ?? '';
  const lastDate  = allDates[allDates.length - 1]?.slice(5) ?? '';

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-full"
      style={{ overflow: 'visible' }}
    >
      {/* 背景网格线 */}
      {yTicks.map(tick => {
        const y = yOf(tick);
        return (
          <g key={tick}>
            <line
              x1={PAD.left} y1={y} x2={W - PAD.right} y2={y}
              stroke="#1A1A1A" strokeWidth="0.4"
            />
            <text
              x={PAD.left - 1} y={y + 0.8}
              textAnchor="end"
              fontSize="3"
              fill="#444"
              fontFamily="'IBM Plex Mono', 'Courier New', monospace"
            >
              {tick >= 1000 ? `${(tick / 1000).toFixed(1)}k` : tick}
            </text>
          </g>
        );
      })}

      {/* X 轴 */}
      <line
        x1={PAD.left} y1={H - PAD.bottom}
        x2={W - PAD.right} y2={H - PAD.bottom}
        stroke="#2A2A2A" strokeWidth="0.5"
      />
      {/* X 轴日期标签：首尾 */}
      <text x={PAD.left} y={H - PAD.bottom + 4} fontSize="2.8" fill="#444" fontFamily="'IBM Plex Mono', 'Courier New', monospace">{firstDate}</text>
      <text x={W - PAD.right} y={H - PAD.bottom + 4} fontSize="2.8" fill="#444" fontFamily="'IBM Plex Mono', 'Courier New', monospace" textAnchor="end">{lastDate}</text>

      {/* 折线 */}
      {series.map(({ cat, points }) => {
        const color = catColor(cat);
        const d = points
          .map((p, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(2)},${yOf(p.value).toFixed(2)}`)
          .join(' ');
        return (
          <g key={cat}>
            <path d={d} fill="none" stroke={color} strokeWidth="0.7" strokeLinejoin="round" strokeLinecap="round" />
            {/* 最后一个点标记 */}
            <circle
              cx={xOf(points.length - 1)}
              cy={yOf(points[points.length - 1].value)}
              r="1"
              fill={color}
            />
          </g>
        );
      })}
    </svg>
  );
}

// ─────────── 左栏 ───────────
function ProfileNavPanel({
  solved, totalScore, myRank, activeCategory, onSelect,
  solvedByCat, active,
}: {
  solved: number;
  totalScore: number;
  myRank: number | null;
  activeCategory: string;
  onSelect: (k: string) => void;
  solvedByCat: Record<string, number>;
  active: boolean;
}) {
  return (
    <div className="flex flex-col h-full">
      {/* 标题 */}
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

      {/* 统计三项 */}
      <div className="px-5 py-4 border-b space-y-3" style={{ borderColor: 'var(--ow-border)' }}>
        <div>
          <GlitchText active={active} text="TOTAL_SCORE" className="text-[9px] uppercase tracking-widest block mb-1" style={{ color: 'var(--ow-text-muted)' }} />
          <GlitchText active={active} text={totalScore.toLocaleString()} className="font-['Inter'] text-2xl font-light" style={{ color: 'var(--ow-text)' }} duration={400} />
        </div>
        <div className="flex gap-4">
          <div>
            <GlitchText active={active} text="SOLVED" className="text-[9px] uppercase tracking-widest block mb-1" style={{ color: 'var(--ow-text-muted)' }} />
            <GlitchText active={active} text={String(solved)} className="font-['Inter'] text-lg font-light" style={{ color: 'var(--ow-text)' }} duration={350} />
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
            const isActive = activeCategory === cat.key;
            const cnt = cat.key === 'all' ? solved : (solvedByCat[cat.key] ?? 0);
            return (
              <li key={cat.key}>
                <button
                  onClick={() => onSelect(cat.key)}
                  className="w-full flex items-center justify-between py-1 transition-colors duration-100 text-left"
                >
                  <GlitchText
                    active={active}
                    text={cat.label}
                    duration={300 + i * 30}
                    className="ow-mono text-[14px]"
                    style={{ color: isActive ? '#F5F5F5' : '#555' }}
                  />
                  <span className="ow-mono text-[12px]" style={{ color: isActive ? '#8A8A8A' : '#333' }}>
                    {cnt > 0 ? cnt : '—'}
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

// ─────────── 成就 Tag ───────────
function AchievementTag({ achievement, active, index }: {
  achievement: Achievement;
  active: boolean;
  index: number;
}) {
  return (
    <div
      title={achievement.description + (achievement.unlockedAt ? " · " + new Date(achievement.unlockedAt).toLocaleString() : "")}
      className="inline-flex flex-wrap items-center gap-1.5 px-2 py-0.5 border ow-mono text-[10px] uppercase tracking-widest shrink-0"
      style={{
        borderColor: achievement.color,
        color: achievement.color,
        background: `${achievement.color}18`,
        opacity: active ? 1 : 0,
        transform: active ? 'translateY(0)' : 'translateY(4px)',
        transition: `opacity 0.2s ease ${index * 60}ms, transform 0.2s ease ${index * 60}ms`,
      }}
    >
      <div
        className="w-1 h-1 shrink-0"
        style={{ background: achievement.color }}
      />
      <GlitchText
        active={active}
        text={(achievement.icon ? achievement.icon + " " : "") + achievement.label}
        duration={300 + index * 50}
      />
      <span className="normal-case text-[9px]">{achievement.description}</span>
      {achievement.unlockedAt && <time className="text-[9px]" dateTime={achievement.unlockedAt}>{new Date(achievement.unlockedAt).toLocaleDateString()}</time>}
    </div>
  );
}

// ─────────── 中栏 ───────────
function ProfileMain({
  username, userGroup, isAdmin, history, activeCategory, active, achievements,
  onFilterOpen,
}: {
  username: string;
  userGroup: number;
  isAdmin: boolean;
  history: ScoreHistoryEntry[];
  activeCategory: string;
  active: boolean;
  achievements: Achievement[];
  onFilterOpen?: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const status = statusLabel(userGroup, isAdmin);
  const statusColor = isAdmin ? '#F5D700' : '#3FB950';

  const filteredHistory = activeCategory === 'all'
    ? history
    : history.filter(e => e.category === activeCategory);

  return (
    <div className="flex flex-col h-full">
      {/* 用户信息区 */}
      <div className="px-4 md:px-6 py-5 border-b" style={{ borderColor: 'var(--ow-border)' }}>
        <div className="flex items-start justify-between gap-2">
          <GlitchText
            active={active}
            text={username.toUpperCase()}
            tag="h1"
            className="font-['Inter'] text-[28px] md:text-[42px] font-light leading-none tracking-tight block"
            style={{ color: 'var(--ow-text)' }}
            duration={700}
          />
          {/* 移动端 FILTER 按钮 */}
          {onFilterOpen && (
            <button
              className="md:hidden px-3 py-1 border ow-mono text-[10px] uppercase tracking-widest transition-colors flex-shrink-0 mt-1"
              style={{ borderColor: 'var(--ow-border)', color: 'var(--ow-text-dim)' }}
              onClick={onFilterOpen}
            >
              [ FILTER ]
            </button>
          )}
        </div>
        <GlitchText
          active={active}
          text={`@${username.toLowerCase()} JOINING CNSS 2026 RECRUITING`}
          className="ow-mono text-[10px] uppercase tracking-widest block mt-1"
          style={{ color: 'var(--ow-text-muted)' }}
          duration={500}
        />
      </div>

      {/* ENLISTED / STATUS */}
      <div className="grid grid-cols-1 md:grid-cols-2 border-b" style={{ borderColor: 'var(--ow-border)' }}>
        <div className="px-6 py-4 border-r" style={{ borderColor: 'var(--ow-border)' }}>
          <GlitchText active={active} text="ENLISTED" className="text-[9px] uppercase tracking-widest block mb-2" style={{ color: 'var(--ow-text-muted)' }} />
          <GlitchText active={active} text={today} className="font-['Inter'] text-sm font-light" style={{ color: 'var(--ow-text)' }} duration={350} />
        </div>
        <div className="px-6 py-4">
          <GlitchText active={active} text="STATUS" className="text-[9px] uppercase tracking-widest block mb-2" style={{ color: 'var(--ow-text-muted)' }} />
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: statusColor, boxShadow: `0 0 5px ${statusColor}80` }} />
            <GlitchText active={active} text={status} className="font-['Inter'] text-sm font-light" style={{ color: statusColor }} duration={350} />
          </div>
        </div>
      </div>

      {/* 成就区域 */}
      {achievements.length > 0 && (
        <div className="px-6 py-3 border-b" style={{ borderColor: 'var(--ow-border)' }}>
          <GlitchText
            active={active}
            text="ACHIEVEMENTS"
            className="text-[9px] uppercase tracking-widest block mb-2"
            style={{ color: 'var(--ow-text-muted)' }}
          />
          <div className="flex flex-wrap gap-2">
            {achievements.map((a, i) => (
              <AchievementTag key={a.key} achievement={a} active={active} index={i} />
            ))}
          </div>
        </div>
      )}

      {/* 折线图区域 */}
      <div className="flex-1 flex flex-col min-h-0 px-6 py-4" style={{ minHeight: '140px' }}>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <GlitchText active={active} text="SCORE_TIMELINE" className="text-[9px] uppercase tracking-widest" style={{ color: 'var(--ow-text-muted)' }} />
          <div className="flex flex-wrap gap-x-3 gap-y-1 justify-end">
            {Object.entries(CAT_COLORS)
              .filter(([c]) => c !== 'notice' && (activeCategory === 'all' || c === activeCategory))
              .filter(([c]) => history.some(h => h.category === c))
              .map(([cat, color]) => (
                <div key={cat} className="flex items-center gap-1">
                  <div className="w-2 h-[2px]" style={{ background: color }} />
                  <span className="ow-mono text-[8px] uppercase" style={{ color: 'var(--ow-text-muted)' }}>{cat}</span>
                </div>
              ))}
          </div>
        </div>
        <div className="flex-1 min-h-0" style={{ minHeight: '140px' }}>
          <ScoreLineChart history={filteredHistory} active={active} />
        </div>
      </div>
    </div>
  );
}

// ─────────── 右栏上：最新动态（滚动循环日志）───────────

const LATEST_OPS_CATEGORY_ORDER = [
  'web',
  'pwn',
  're',
  'misc',
  'crypto',
  'sa',
  'dev',
  'blockchain',
  'design',
  'hpc',
] as const;

const LATEST_OPS_CATEGORY_LABELS: Record<string, string> = {
  blockchain: 'CHAIN',
};

const LATEST_OPS_CATEGORY_PRIORITY = new Map<string, number>(
  LATEST_OPS_CATEGORY_ORDER.map((category, index) => [category, index]),
);

function dominantCategory(scoreList: RankedEntry['scoreList']) {
  const scoredCategories = scoreList
    .filter(({ score }) => score > 0)
    .map(({ category, score }) => ({ category: category.toLowerCase(), score }));

  const dominant = scoredCategories.reduce<(typeof scoredCategories)[number] | undefined>((best, current) => {
    if (!best || current.score > best.score) return current;
    if (current.score < best.score) return best;

    const currentPriority = LATEST_OPS_CATEGORY_PRIORITY.get(current.category) ?? Number.MAX_SAFE_INTEGER;
    const bestPriority = LATEST_OPS_CATEGORY_PRIORITY.get(best.category) ?? Number.MAX_SAFE_INTEGER;
    if (currentPriority !== bestPriority) return currentPriority < bestPriority ? current : best;
    return current.category.localeCompare(best.category) < 0 ? current : best;
  }, undefined);

  if (!dominant) return { tag: 'N/A', color: '#555' };

  return {
    tag: LATEST_OPS_CATEGORY_LABELS[dominant.category] ?? dominant.category.toUpperCase(),
    color: catColor(dominant.category),
  };
}

// 把 scoreboard 数据转为日志条目
function buildLogEntries(rankings: RankedEntry[]) {
  return rankings.slice(0, 10).map((r, i) => {
    const { tag, color } = dominantCategory(r.scoreList);
    return {
      tag,
      username: r.username,
      score: r.score,
      color,
      rankColor_: i === 0 ? '#F5D700' : i < 3 ? '#C0C0C0' : '#555',
    };
  });
}

function LatestOpsPanel({ active }: { active: boolean }) {
  const { data: rankings = [], isLoading } = useQuery({
    queryKey: ['scoreboard', 'active'],
    queryFn: () => getScoreboardByDirection(0),
    retry: 1,
  });

  const MAX_VISIBLE = 50;
  const [visibleLines, setVisibleLines] = useState<
    { id: number; tag: string; username: string; score: number; color: string; fresh: boolean }[]
  >([]);
  const cursorRef = useRef(0);
  const idRef     = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 新行追加后自动滚到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [visibleLines.length]);

  // 当数据就绪 + 面板激活时开始滚动
  useEffect(() => {
    if (!active || isLoading || !rankings.length) return;

    const entries = buildLogEntries(rankings);

    // 先填入初始6行
    const initial = entries.slice(0, 6).map((e) => ({
      id: idRef.current++,
      tag: e.tag,
      username: e.username,
      score: e.score,
      color: e.color,
      fresh: false,
    }));
    setVisibleLines(initial);
    cursorRef.current = initial.length % entries.length;

    // 之后每 1.6s 追加一行（循环）
    const timer = setInterval(() => {
      const e = entries[cursorRef.current % entries.length];
      cursorRef.current = (cursorRef.current + 1) % entries.length;
      const newLine = {
        id: idRef.current++,
        tag: e.tag,
        username: e.username,
        score: e.score,
        color: e.color,
        fresh: true,
      };
      setVisibleLines(prev => {
        const next = [...prev, newLine].slice(-MAX_VISIBLE);
        setTimeout(() => {
          setVisibleLines(cur => cur.map(l => l.id === newLine.id ? { ...l, fresh: false } : l));
        }, 50);
        return next;
      });
    }, 1600);

    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, isLoading, rankings.length]);

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--ow-border)' }}>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#3FB950', boxShadow: '0 0 5px rgba(63,185,80,0.6)', animation: 'pulse 2s infinite' }} />
          <GlitchText active={active} text="LATEST_OPS" className="ow-mono font-bold text-[12px] tracking-widest" style={{ color: 'var(--ow-text)' }} />
        </div>
        <span className="ow-mono text-[9px] tracking-widest" style={{ color: 'var(--ow-text-muted)' }}>LIVE</span>
      </div>
      {/* 可滚动区：内容从顶部填充，自动滚到最新行 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-0.5" style={{ scrollbarWidth: 'none' }}>
        {isLoading ? (
          <span className="ow-mono text-[11px]" style={{ color: 'var(--ow-text-muted)' }}>{'> CONNECTING...'}</span>
        ) : (
          <>
            {visibleLines.map((line) => (
              <div
                key={line.id}
                className="ow-mono text-[11px] leading-relaxed flex-shrink-0"
                style={{
                  color: 'var(--ow-text-muted)',
                  opacity: line.fresh ? 0 : 1,
                  transform: line.fresh ? 'translateY(3px)' : 'translateY(0)',
                  transition: 'opacity 0.25s ease, transform 0.25s ease',
                }}
              >
                <span style={{ color: 'var(--ow-text)' }}>{'> '}</span>
                <span style={{ color: line.color }}>[{line.tag}]</span>
                {' '}
                <span style={{ color: 'var(--ow-text-dim)' }}>{line.username}</span>
                {' '}
                <span style={{ color: '#3FB950' }}>+{line.score.toLocaleString()}</span>
                <span style={{ color: 'var(--ow-text-muted)' }}>{' pts'}</span>
              </div>
            ))}
            {/* 光标行 */}
            <div className="ow-mono text-[11px] flex-shrink-0" style={{ color: 'var(--ow-text-muted)' }}>
              <span style={{ color: 'var(--ow-text)' }}>{'> '}</span>
              <span
                className="inline-block w-[7px] h-[11px] align-middle"
                style={{ background: '#3FB950', animation: '1s step-end 0s infinite running ow-blink' }}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─────────── 右栏下：FAQ ───────────
const FAQ_ITEMS = [
  { q: 'CNSS 2026 是什么？',    a: 'CNSS 2026 是 UESTC 网安协会的年度招新赛，包含 Web、Pwn、Crypto 等多个方向。' },
  { q: 'FLAG 的格式是什么？',   a: 'Flag 格式为 CNSS{...}，大小写敏感，提交时请完整复制。' },
  { q: '题目什么时候开放？',    a: '所有题目在比赛开始时统一开放，关注通知频道获取最新信息。' },
  { q: '我可以组队吗？',        a: '本次招新赛为个人赛，请独立完成，禁止抄袭和分享 flag。' },
  { q: '遇到问题怎么办？',      a: '可以在 QQ 群内提问，但不要直接询问 flag 或解题思路。' },
];

function FaqPanel({ active }: { active: boolean }) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: 'var(--ow-border)' }}>
        <div className="w-1.5 h-1.5" style={{ background: 'var(--ow-text-muted)' }} />
        <GlitchText active={active} text="FAQ" className="ow-mono font-bold text-[12px] tracking-widest" style={{ color: 'var(--ow-text)' }} />
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {FAQ_ITEMS.map((item, i) => (
          <div
            key={i}
            style={{ opacity: active ? 1 : 0, transition: `opacity 0.2s ease ${i * 100}ms` }}
          >
            <div className="ow-mono text-[11px] uppercase tracking-widest mb-1" style={{ color: 'var(--ow-text-dim)' }}>
              {`Q: ${item.q}`}
            </div>
            <div className="ow-mono text-[11px] leading-relaxed" style={{ color: 'var(--ow-text-dim)' }}>
              {`A: ${item.a}`}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────── 主页面 ───────────
export default function ProfilePage() {
  const { user, isAuthenticated } = useAuthStore();
  const [activeCategory, setActiveCategory] = useState('all');
  const drawer = useSidebarDrawer();

  const [leftReady,        setLeftReady]        = useState(false);
  const [centerReady,      setCenterReady]      = useState(false);
  const [rightTopReady,    setRightTopReady]    = useState(false);
  const [rightBottomReady, setRightBottomReady] = useState(false);

  const onLeftDone        = useCallback(() => setLeftReady(true),        []);
  const onCenterDone      = useCallback(() => setCenterReady(true),      []);
  const onRightTopDone    = useCallback(() => setRightTopReady(true),    []);
  const onRightBottomDone = useCallback(() => setRightBottomReady(true), []);

  const userId = user?.userId ?? 0;

  const { data: solved = [] } = useQuery({
    queryKey: ['solved', userId],
    queryFn: () => getSolvedChallenges(userId),
    enabled: isAuthenticated && userId > 0,
    retry: 1,
  });

  const { data: rankings = [] } = useQuery({
    queryKey: ['scoreboard', 'active'],
    queryFn: () => getScoreboardByDirection(0),
    retry: 1,
  });

  const { data: history = [] } = useQuery({
    queryKey: ['scorehistory', userId],
    queryFn: () => getScoreHistory(userId),
    enabled: isAuthenticated && userId > 0,
    retry: 1,
  });

  const { data: achievements = [] } = useQuery({
    queryKey: ['achievements', userId],
    queryFn: () => getAchievements(userId),
    enabled: isAuthenticated && userId > 0,
    retry: 1,
  });

  const totalScore = solved.reduce((s, c) => s + c.score, 0);
  const myRank = user
    ? (rankings.find(r => r.username === user.username)?.rank ?? null)
    : null;

  const solvedByCat = useMemo(() => {
    const m: Record<string, number> = {};
    solved.forEach(c => {
      const k = c.category?.toLowerCase() ?? 'misc';
      m[k] = (m[k] ?? 0) + 1;
    });
    return m;
  }, [solved]);

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-[calc(100dvh-3rem)] items-center justify-center" style={{ background: 'var(--ow-bg)' }}>
        <div className="text-center space-y-4">
          <p className="ow-mono text-[11px] uppercase tracking-widest" style={{ color: 'var(--ow-text-muted)' }}>ERR: NOT_AUTHENTICATED</p>
          <Link href="/login"
            className="inline-block px-4 py-2 border ow-mono text-[11px] uppercase tracking-widest"
            style={{ borderColor: '#555', color: 'var(--ow-text-mid)' }}>
            [ LOGIN ]
          </Link>
        </div>
      </div>
    );
  }

  const panelBase  = "relative flex flex-col overflow-hidden";
  const panelStyle = { background: 'var(--ow-panel-bg-main)' };

  return (
    <div
      className="flex min-h-[calc(100dvh-3rem)] p-3 md:p-4 gap-3 md:gap-4"
      style={{ background: 'var(--ow-bg)' }}
    >
      {/* 左栏 — 桌面端内联，移动端通过抽屉 */}
      <PanelReveal delay={0} onComplete={onLeftDone}
        className={`${panelBase} w-[240px] xl:w-[280px] flex-shrink-0 hidden md:flex`}
        style={panelStyle}>
        <ProfileNavPanel
          solved={solved.length}
          totalScore={totalScore}
          myRank={myRank}
          activeCategory={activeCategory}
          onSelect={setActiveCategory}
          solvedByCat={solvedByCat}
          active={leftReady}
        />
      </PanelReveal>

      {/* 移动端抽屉：active 硬编码 true，因为 hidden md:flex 左栏在移动端不触发 onComplete */}
      <SidebarDrawer open={drawer.open} onClose={drawer.close}>
        <ProfileNavPanel
          solved={solved.length}
          totalScore={totalScore}
          myRank={myRank}
          activeCategory={activeCategory}
          onSelect={(k) => { setActiveCategory(k); drawer.close(); }}
          solvedByCat={solvedByCat}
          active={true}
        />
      </SidebarDrawer>

      {/* 中栏 */}
      <PanelReveal delay={0} onComplete={onCenterDone}
        className={`${panelBase} flex-1 min-w-0`}
        style={panelStyle}>
        <ProfileMain
          username={user?.username ?? ''}
          userGroup={user?.userGroup ?? 0}
          isAdmin={((user?.role ?? 0) > 0)}
          history={history}
          activeCategory={activeCategory}
          active={centerReady}
          achievements={achievements}
          onFilterOpen={drawer.toggle}
        />
      </PanelReveal>

      {/* 右栏：上下两个独立面板 */}
      <div className="hidden lg:flex flex-col gap-3 md:gap-4 w-[220px] xl:w-[260px] flex-shrink-0">
        <PanelReveal delay={0} onComplete={onRightTopDone}
          className={`${panelBase} flex-1`}
          style={panelStyle}>
          <LatestOpsPanel active={rightTopReady} />
        </PanelReveal>

        <PanelReveal delay={0} onComplete={onRightBottomDone}
          className={`${panelBase} flex-1`}
          style={panelStyle}>
          <FaqPanel active={rightBottomReady} />
        </PanelReveal>
      </div>
    </div>
  );
}

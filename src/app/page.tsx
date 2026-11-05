'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { SwarmText } from '@/components/landing/SwarmText';
import { TerminalPanel } from '@/components/landing/TerminalPanel';
import { ProgressBar } from '@/components/landing/ProgressBar';
import { getChallengesByCategory } from '@/lib/api/challenge';
import { getRecentSolves, getGlobalStats } from '@/lib/api/user';
import { useAuthStore } from '@/store/authStore';

/**
 * 入口/Landing 页
 *
 * 进度条逻辑：
 *   - 已登录：显示个人得分 / 个人解题数（TOTAL_SCORE / SOLVED_AGGREGATE）
 *   - 未登录：显示平台整体（TOTAL_SCORE_GLOBAL / SOLVED_AGGREGATE_GLOBAL）
 */
export default function Home() {
  const { isAuthenticated } = useAuthStore();

  // ── 个人数据（需登录）──────────────────────────────────────────────────────
  const { data: allChallenges = [] } = useQuery({
    queryKey: ['challenges-all-stats'],
    queryFn: () => getChallengesByCategory('all'),
    enabled: isAuthenticated,
    retry: 1,
  });

  // ── 平台全局数据（公开）─────────────────────────────────────────────────────
  const { data: globalStats } = useQuery({
    queryKey: ['global-stats'],
    queryFn: getGlobalStats,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  // ── 最近解题动态（公开）─────────────────────────────────────────────────────
  const { data: recentSolves = [] } = useQuery({
    queryKey: ['recent-solves'],
    queryFn: () => getRecentSolves(6),
    staleTime: 60 * 1000,
    retry: 1,
  });

  // ── 统计计算 ────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (isAuthenticated && allChallenges.length > 0) {
      const totalMaxScore = allChallenges.reduce((s, c) => s + (c.score ?? 0), 0);
      const myTotalScore  = allChallenges.reduce((s, c) => s + (c.yourScore ?? 0), 0);
      const totalCount    = allChallenges.length;
      const solvedCount   = allChallenges.filter(c => (c.yourScore ?? 0) > 0).length;
      const scorePercent  = totalMaxScore > 0 ? Math.round((myTotalScore  / totalMaxScore) * 100) : 0;
      const solvedPercent = totalCount    > 0 ? Math.round((solvedCount   / totalCount)   * 100) : 0;
      return {
        isGlobal: false,
        scoreLabel:  'TOTAL_SCORE',
        solvedLabel: 'SOLVED_AGGREGATE',
        myTotalScore, totalMaxScore, scorePercent,
        solvedCount, totalCount, solvedPercent,
      };
    }
    // 未登录：显示平台整体
    const g = globalStats ?? { totalScore: 0, maxScore: 0, solvedCount: 0, challengeCount: 0 };
    const scorePercent  = g.maxScore        > 0 ? Math.round((g.totalScore  / g.maxScore)        * 100) : 0;
    const solvedPercent = g.challengeCount  > 0 ? Math.round((g.solvedCount / g.challengeCount)  * 100) : 0;
    return {
      isGlobal: true,
      scoreLabel:  'TOTAL_SCORE_GLOBAL',
      solvedLabel: 'SOLVED_AGGREGATE_GLOBAL',
      myTotalScore: g.totalScore, totalMaxScore: g.maxScore, scorePercent,
      solvedCount: g.solvedCount, totalCount: g.challengeCount, solvedPercent,
    };
  }, [isAuthenticated, allChallenges, globalStats]);

  return (
    <div
      className="relative min-h-[calc(100dvh-3rem)] flex flex-col select-none"
      style={{ background: 'var(--ow-bg)', color: 'var(--ow-text)' }}
    >
      <div
        data-swarm-id="page-frame"
        data-swarm-kind="frame"
        className="relative flex-1 mx-2 my-3 md:mx-9 md:my-6 flex flex-col border"
        style={{ borderColor: 'var(--ow-border)', background: 'var(--ow-bg)' }}
      >
        {/* ── Hero 区 ── */}
        <div className="flex-1 flex flex-col justify-center px-4 pt-6 pb-4 md:px-16 md:pt-10 md:pb-6 gap-6">

          {/* 副标题 */}
          <p
            className="ow-mono text-[13px] tracking-widest"
            style={{ color: '#6E6E6E' }}
          >
            <SwarmText id="kicker" after="page-frame">Cohesion Network Security Studio</SwarmText>
          </p>

          {/* 标题与终端方块各自构造 */}
          <h1
            className="font-['Inter'] leading-none tracking-tighter"
            style={{ fontSize: 'clamp(28px, 7vw, 118px)', color: 'var(--ow-text)' }}
          >
            <SwarmText id="title" after="kicker" align>
              CNSS-RECRUITING
            </SwarmText>
            <span
              data-swarm-id="title-cursor" data-swarm-kind="detail" data-swarm-after="title"
              className="inline-block w-[0.55em] h-[0.85em] align-bottom ml-1"
              style={{ background: 'var(--ow-text)' }}
            />
          </h1>

          {/* 竖线 + 中文描述 */}
          <div className="flex gap-6 items-start max-w-4xl">
            <div data-swarm-id="intro-rule" data-swarm-kind="rule" data-swarm-after="page-frame"
              className="w-px shrink-0 self-stretch mt-1" style={{ background: '#5A5F6E' }} />
            <p
              className="font-['Inter'] text-[clamp(14px,1.5vw,24px)] leading-relaxed"
              style={{ color: '#8E93A8' }}
            >
              <SwarmText id="intro" after="title intro-rule">
                凝聚网络安全工作室成立于 2007 年，是成电悠久的工作室文化的代表。凝聚标志着电子科大本科生在计算机领域的最高水平，一届又一届，我们致力于将严谨的研究氛围、敢于挑战的精神与创新文化不间断地向下传递。
              </SwarmText>
            </p>
          </div>
        </div>

        {/* ── 两条进度条 ── */}
        <div className="px-4 pb-4 md:px-16 md:pb-8 flex flex-col gap-6">
          <ProgressBar
            label={stats.scoreLabel}
            value={`${stats.myTotalScore.toLocaleString()} / ${stats.totalMaxScore.toLocaleString()}`}
            percent={stats.scorePercent}
            assemblyId="score"
          />
          <ProgressBar
            label={stats.solvedLabel}
            value={`${stats.solvedCount} / ${stats.totalCount}`}
            percent={stats.solvedPercent}
            assemblyId="solved"
            dim
          />
        </div>

        {/* ── 底部双面板 ── */}
        <div className="mx-2 mb-2 md:mx-4 md:mb-4 flex flex-col md:flex-row gap-4 md:h-[235px]">
          {/* 左：终端输出（动态化） */}
          <TerminalPanel recentSolves={recentSolves} />

          {/* 右：Command Input */}
          <Link
            href="/challenges"
            data-swarm-id="command-frame"
            data-swarm-kind="frame"
            data-swarm-after="page-frame"
            className="w-full md:w-[30%] min-h-28 flex-shrink-0 flex flex-col justify-center px-8 md:px-12 gap-2 border
                       transition-opacity hover:opacity-90"
            style={{ background: 'var(--ow-panel-bg-alt)', borderColor: 'var(--ow-border)' }}
          >
            <span
              className="ow-mono text-[13px] uppercase tracking-widest"
              style={{ color: 'var(--ow-text-dim)' }}
            >
              <SwarmText id="command-label" after="command-frame">COMMAND INPUT</SwarmText>
            </span>
            <span
              className="font-['Inter'] font-bold text-[26px] leading-none"
              style={{ color: 'var(--ow-text)' }}
            >
              <SwarmText id="command-enter" after="command-label">{'> ENTER'}</SwarmText>
              <span
                data-swarm-id="command-cursor" data-swarm-kind="detail" data-swarm-after="command-enter"
                className="inline-block w-[12px] h-[20px] ml-1 align-bottom"
                style={{ background: 'var(--ow-text-muted)' }}
              />
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}

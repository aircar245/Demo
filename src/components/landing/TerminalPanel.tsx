'use client';

import { motion } from 'framer-motion';
import type { RecentSolve } from '@/lib/api/user';
import { SwarmText } from './SwarmText';

/**
 * 终端面板 — 底部左侧
 *
 * 结构：
 *   1. 固定的 3 条启动行（始终逐行淡入，不依赖 active）
 *   2. panelDone（active=true）后，追加真实解题动态，逐行淡入
 *
 * Props:
 *   active       — PanelReveal 完成后为 true，触发动态行的显示
 *   recentSolves — 后端返回的最近解题列表（可为空数组）
 */

interface TerminalPanelProps {
  active?: boolean;
  recentSolves?: RecentSolve[];
  assemble?: boolean;
}

const BOOT_LINES = [
  { text: '> Initializing CNSS-2026 platform...', color: '#3A3F47', delay: 0.2 },
  { text: '> Loading challenge database...',       color: '#3A3F47', delay: 0.6 },
  { text: '> Indexing records...',                 color: '#5C616B', delay: 1.0 },
];

// 分类颜色映射
const CATEGORY_COLOR: Record<string, string> = {
  web:        '#3FB950',
  pwn:        '#E12E38',
  crypto:     '#F5D700',
  re:         '#FF6200',
  misc:       '#8A8A8A',
  dev:        '#3FB950',
  sa:         '#5C9AFF',
  design:     '#C87AFF',
  hpc:        '#FF6200',
  blockchain: '#F5D700',
  notice:     '#8A8A8A',
};

function categoryColor(cat: string): string {
  return CATEGORY_COLOR[cat.toLowerCase()] ?? '#5C616B';
}

export function TerminalPanel({ active = false, recentSolves = [], assemble = false }: TerminalPanelProps) {
  return (
    <div
      data-swarm-id={assemble ? 'terminal-frame' : undefined}
      data-swarm-kind={assemble ? 'frame' : undefined}
      data-swarm-after={assemble ? 'page-frame' : undefined}
      className={`flex-1 border relative overflow-hidden ${assemble ? 'min-h-[210px]' : ''}`}
      style={{ background: '#080808', borderColor: '#7F7F7F' }}
    >
      <div className="absolute inset-0 flex flex-col justify-end p-6 pb-8 gap-0">

        {/* ── 启动行（无论 active 都会播放，按自身 delay 淡入）── */}
        {BOOT_LINES.map((line, i) => (
          assemble ? (
            <div key={i} className="ow-mono text-[13px] leading-[1.8]" style={{ color: line.color }}>
              <SwarmText id={`terminal-line-${i}`} after={i ? `terminal-line-${i-1}` : 'terminal-frame'}>
                {line.text}
              </SwarmText>
            </div>
          ) : <motion.div
            key={i}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: line.delay, duration: 0.15 }}
            className="ow-mono text-[13px] leading-[1.8]"
            style={{ color: line.color }}
          >
            {line.text}
          </motion.div>
        ))}

        {/* ── SYSTEM_READY 行（active 后才出现）── */}
        <motion.div
          data-swarm-terminal-live={assemble ? '' : undefined}
          initial={{ opacity: 0 }}
          animate={{ opacity: active ? 1 : 0 }}
          transition={{ delay: active ? 0.05 : 0, duration: 0.15 }}
          className="ow-mono text-[13px] leading-[1.8] flex items-center gap-0"
          style={{ color: '#00B06E' }}
        >
          <span>&gt; SYSTEM_READY_FOR_QUERY</span>
          <span
            className="inline-block w-[8px] h-[13px] ml-1"
            style={{
              background: '#00B06E',
              animation: active
                ? '1s step-end 0s infinite normal none running ow-blink'
                : 'none',
              opacity: active ? 1 : 0,
            }}
          />
        </motion.div>

        {/* ── 动态行：recent solves（active 后逐行淡入）── */}
        {recentSolves.map((solve, i) => (
          <motion.div
            key={`solve-${i}`}
            data-swarm-terminal-live={assemble ? '' : undefined}
            initial={{ opacity: 0 }}
            animate={{ opacity: active ? 1 : 0 }}
            transition={{ delay: active ? 0.15 + i * 0.12 : 0, duration: 0.2 }}
            className="ow-mono text-[12px] leading-[1.8]"
            style={{ color: '#5C616B' }}
          >
            {'> '}
            <bdi dir="auto" style={{ color: '#C8CCD2' }}>{solve.username}</bdi>
            {' solved '}
            <bdi dir="auto" style={{ color: '#F5F5F5' }}>{solve.title}</bdi>
            {' ['}
            <span style={{ color: categoryColor(solve.category) }}>{solve.category}</span>
            {']'}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

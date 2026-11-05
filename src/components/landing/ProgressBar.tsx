'use client';

import { useEffect, useRef, useState } from 'react';
import { SwarmText } from './SwarmText';

/**
 * 进度条组件 — Figma ENTRY yea_block / nay_block
 * label: 指标名, value: 显示值（字符串，直接显示）
 * percent: 0-100, dim: 暗色模式
 * active: false 时停在0，true 时触发动画
 * countFrom / countTo: 传入时启用数字滚动（整数）
 */
interface ProgressBarProps {
  label: string;
  value: string;
  percent: number;
  dim?: boolean;
  active?: boolean;
  /** 若提供，value 会被忽略，改用滚动数字显示 */
  countTo?: number;
  countSuffix?: string;   // 滚动数字后拼接的字符串，如 " / 2400"
  assemblyId?: string;
}

function useCountUp(target: number, active: boolean, duration = 1200) {
  const [current, setCurrent] = useState(0);
  const rafRef = useRef<number>(0);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!active) return;
    if (startedRef.current) return;
    startedRef.current = true;

    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      const p = Math.min(elapsed / duration, 1);
      // easeOutCubic
      const eased = 1 - (1 - p) ** 3;
      setCurrent(Math.round(eased * target));
      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setCurrent(target);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [active, target, duration]);

  return current;
}

export function ProgressBar({
  label,
  value,
  percent,
  dim = false,
  active = true,
  countTo,
  countSuffix = '',
  assemblyId,
}: ProgressBarProps) {
  const rolled = useCountUp(countTo ?? 0, active && countTo !== undefined);
  const displayValue = countTo !== undefined
    ? `${rolled.toLocaleString()}${countSuffix}`
    : value;

  // 分块进度条：40 个方块，从左到右依次点亮
  const TOTAL_BLOCKS = 40;
  const filledCount = Math.round((percent / 100) * TOTAL_BLOCKS);

  return (
    <div className="flex flex-col gap-2" data-swarm-metric={assemblyId ? '' : undefined}>
      <div className="flex items-end justify-between">
        <span
          className="ow-mono text-[13px] tracking-widest uppercase"
          style={{ color: '#6E6E6E' }}
        >
          {assemblyId ? <SwarmText id={`${assemblyId}-label`} after="page-frame">{label}</SwarmText> : label}
        </span>
        <span
          className="font-['Inter'] text-5xl leading-none transition-opacity duration-300"
          data-swarm-metric-value={assemblyId ? '' : undefined}
          style={{
            color: dim ? '#707070' : '#F5F5F5',
            opacity: active ? 1 : 0,
          }}
        >
          {displayValue}
        </span>
      </div>
      {/* 分块进度条 */}
      <div className="w-full h-[22px] flex gap-[2px]"
        data-swarm-id={assemblyId ? `${assemblyId}-track` : undefined}
        data-swarm-kind={assemblyId ? 'blocks' : undefined}
        data-swarm-after={assemblyId ? `${assemblyId}-label` : undefined}
      >
        {Array.from({ length: TOTAL_BLOCKS }, (_, i) => {
          const isFilled = i < filledCount;
          // 每个方块的点亮延迟：匀速分布在 1100ms 内
          const delay = active && isFilled
            ? Math.round((i / Math.max(filledCount, 1)) * 1100)
            : 0;
          return (
            <div
              key={i}
              data-swarm-cell={assemblyId ? '' : undefined}
              className="flex-1 h-full"
              style={{
                background: active && isFilled
                  ? (dim ? '#3A3A3A' : '#F5F5F5')
                  : '#141414',
                transition: active && isFilled
                  ? `background-color 0.08s step-end ${delay}ms`
                  : 'none',
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

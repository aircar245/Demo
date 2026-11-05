'use client';

import { SwarmText } from './SwarmText';

interface ProgressBarProps {
  label: string;
  value: string;
  percent: number;
  dim?: boolean;
  assemblyId: string;
}

export function ProgressBar({
  label,
  value,
  percent,
  dim = false,
  assemblyId,
}: ProgressBarProps) {
  const TOTAL_BLOCKS = 40;
  const filledCount = Math.round((percent / 100) * TOTAL_BLOCKS);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end justify-between">
        <span
          className="ow-mono text-[13px] tracking-widest uppercase"
          style={{ color: '#6E6E6E' }}
        >
          <SwarmText id={`${assemblyId}-label`} after="page-frame">{label}</SwarmText>
        </span>
        <span
          className="font-['Inter'] text-5xl leading-none"
          style={{ color: dim ? '#707070' : '#F5F5F5' }}
        >
          <SwarmText id={`${assemblyId}-value`} after={`${assemblyId}-track`}>{value}</SwarmText>
        </span>
      </div>
      {/* 分块进度条 */}
      <div className="w-full h-[22px] flex gap-[2px]"
        data-swarm-id={`${assemblyId}-track`}
        data-swarm-kind="blocks"
        data-swarm-after={`${assemblyId}-label`}
      >
        {Array.from({ length: TOTAL_BLOCKS }, (_, i) => {
          return (
            <div
              key={i}
              data-swarm-cell=""
              className="flex-1 h-full"
              style={{
                background: i < filledCount ? (dim ? '#3A3A3A' : '#F5F5F5') : '#141414',
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

import type { RecentSolve } from '@/lib/api/user';
import { SwarmText } from './SwarmText';

const BOOT_LINES = [
  { text: '> Initializing CNSS-2026 platform...', color: '#3A3F47' },
  { text: '> Loading challenge database...', color: '#3A3F47' },
  { text: '> Indexing records...', color: '#5C616B' },
];

const CATEGORY_COLOR: Record<string, string> = {
  web: '#3FB950', pwn: '#E12E38', crypto: '#F5D700', re: '#FF6200',
  misc: '#8A8A8A', dev: '#3FB950', sa: '#5C9AFF', design: '#C87AFF',
  hpc: '#5C9AFF', blockchain: '#F5D700', notice: '#8A8A8A',
};

export function TerminalPanel({ recentSolves = [] }: { recentSolves?: RecentSolve[] }) {
  return (
    <div
      data-swarm-id="terminal-frame"
      data-swarm-kind="frame"
      data-swarm-after="page-frame"
      className="flex-1 border relative overflow-hidden min-h-[210px]"
      style={{ background: '#080808', borderColor: '#7F7F7F' }}
    >
      <div className="absolute inset-0 flex flex-col justify-end p-6 pb-8">
        {BOOT_LINES.map((line, index) => (
          <div key={line.text} className="ow-mono text-[13px] leading-[1.8]" style={{ color: line.color }}>
            <SwarmText id={'terminal-line-' + index} after={index ? 'terminal-line-' + (index - 1) : 'terminal-frame'}>
              {line.text}
            </SwarmText>
          </div>
        ))}
        <div className="ow-mono text-[13px] leading-[1.8] flex items-center" style={{ color: '#00B06E' }}>
          <SwarmText id="terminal-status" after="terminal-line-2">{'> SYSTEM_READY_FOR_QUERY'}</SwarmText>
          <span
            data-swarm-id="terminal-cursor"
            data-swarm-kind="detail"
            data-swarm-after="terminal-status"
            className="inline-block w-[8px] h-[13px] ml-1 align-bottom"
            style={{ background: '#00B06E' }}
          />
        </div>
        {recentSolves.map((solve, index) => (
          <div key={index} className="ow-mono text-[12px] leading-[1.8]" style={{ color: '#5C616B' }}>
            {'> '}
            <bdi dir="auto" style={{ color: '#C8CCD2' }}>{solve.username}</bdi>
            {' solved '}
            <bdi dir="auto" style={{ color: '#F5F5F5' }}>{solve.title}</bdi>
            {' ['}
            <span style={{ color: CATEGORY_COLOR[solve.category.toLowerCase()] ?? '#5C616B' }}>{solve.category}</span>
            {']'}
          </div>
        ))}
      </div>
    </div>
  );
}

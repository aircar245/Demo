'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * PanelReveal v7
 *
 * 修复：
 *  1. 光标随白色渐变同步淡出（opacity = whiteOpacity）
 *  2. 边框四条线随展开进度即时出现（不再等 done）
 *  3. Corner 高亮跟随展开进度淡入（opacity = progress），展开结束时完全可见
 */

interface PanelRevealProps {
  delay?: number;
  /** Let long forms determine panel height instead of requiring a sized parent. */
  contentSized?: boolean;
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onComplete?: () => void;
}

type Phase = 'idle' | 'cursor' | 'expanding' | 'done';

const BORDER      = 'var(--ow-border)';
const WHITE       = 'var(--ow-text)';
const CORNER_SIZE = 14;

export function PanelReveal({
  delay = 0,
  contentSized = false,
  children,
  className = '',
  style,
  onComplete,
}: PanelRevealProps) {
  const [phase, setPhase]       = useState<Phase>('idle');
  const [cursorOn, setCursorOn] = useState(true);
  const [pw, setPw]             = useState(0);   // 宽度进度 0→1
  const [ph, setPh]             = useState(0);   // 高度进度 0→1
  const [progress, setProgress] = useState(0);   // 总体进度 0→1（用于 corner / 光标 / 白块）

  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const rafRef   = useRef<number>(0);

  useEffect(() => {
    let alive = true;

    timerRef.current = setTimeout(() => {
      if (!alive) return;
      setPhase('cursor');

      let n = 0;
      const blink = setInterval(() => {
        if (!alive) { clearInterval(blink); return; }
        setCursorOn(v => !v);
        if (++n >= 4) {
          clearInterval(blink);
          setCursorOn(true);
          if (!alive) return;

          setPhase('expanding');
          const t0  = performance.now();
          const dur = 420;

          const tick = (now: number) => {
            if (!alive) return;
            const e   = now - t0;
            const p   = Math.min(e / dur, 1);                       // 线性进度
            const eW  = 1 - (1 - p) ** 3;                           // 宽度 easeOutCubic
            const pH2 = Math.max((e - 80) / (dur - 60), 0);
            const eH  = 1 - (1 - Math.min(pH2, 1)) ** 3;           // 高度略慢

            setPw(eW);
            setPh(eH);
            setProgress(p);

            if (p < 1) {
              rafRef.current = requestAnimationFrame(tick);
            } else {
              setPw(1); setPh(1); setProgress(1);
              setPhase('done');
              onComplete?.();
            }
          };
          rafRef.current = requestAnimationFrame(tick);
        }
      }, 110);
    }, delay);

    return () => {
      alive = false;
      clearTimeout(timerRef.current);
      cancelAnimationFrame(rafRef.current);
    };
  }, [delay, onComplete]);

  const isDone      = phase === 'done';
  const isExpanding = phase === 'expanding';
  const isCursor    = phase === 'cursor';
  const hasStarted  = phase !== 'idle';

  const whiteOpacity  = 1 - progress;            // 白块透明度：1→0
  const cornerOpacity = progress;                 // corner：0→1（随展开同步显示）
  const showContent   = isExpanding || isDone;

  return (
    <div className={`relative ${className}`} style={{ ...style, overflow: 'visible' }}>
      <div style={{ position: contentSized ? 'relative' : 'absolute', inset: 0, overflow: 'hidden' }}>

        {/* 黑色底遮罩（expanding / done 前全覆盖） */}
        {!isDone && (
          <div style={{ position: 'absolute', inset: 0, background: 'var(--ow-bg)', zIndex: 10 }} />
        )}

        {/* 白色扩张块：初始尺寸 = 光标方块，确保从小方块平滑展开 */}
        {isExpanding && (
          <div style={{
            position: 'absolute', top: 0, left: 0, zIndex: 11,
            width:   `calc(max(${CORNER_SIZE}px, ${pw * 100}%))`,
            height:  `calc(max(${CORNER_SIZE}px, ${ph * 100}%))`,
            background: WHITE,
            opacity: whiteOpacity,
          }} />
        )}

        {/* 光标方块：仅在 cursor 阶段闪烁；expanding 阶段由扩张块接管 */}
        {isCursor && (
          <div style={{
            position: 'absolute', top: 0, left: 0, zIndex: 15,
            width: CORNER_SIZE, height: CORNER_SIZE,
            background: WHITE,
            opacity: cursorOn ? 1 : 0,
          }} />
        )}

        {/* 边框四条线：随展开进度延伸（始终可见，不等 done） */}
        {hasStarted && (
          <>
            {/* 上边 */}
            <div style={{
              position: 'absolute', top: 0, left: 0, height: 1, zIndex: 12,
              width: `${isDone ? 100 : pw * 100}%`,
              background: BORDER,
            }} />
            {/* 左边 */}
            <div style={{
              position: 'absolute', top: 0, left: 0, width: 1, zIndex: 12,
              height: `${isDone ? 100 : ph * 100}%`,
              background: BORDER,
            }} />
            {/* 右边（宽度 > 80% 开始出现） */}
            <div style={{
              position: 'absolute', top: 0, right: 0, width: 1, zIndex: 12,
              height: `${isDone ? 100 : ph * 100}%`,
              background: BORDER,
              opacity: isDone ? 1 : Math.min(Math.max((pw - 0.8) / 0.2, 0), 1),
            }} />
            {/* 下边（高度 > 80% 开始出现） */}
            <div style={{
              position: 'absolute', bottom: 0, left: 0, height: 1, zIndex: 12,
              width: `${isDone ? 100 : pw * 100}%`,
              background: BORDER,
              opacity: isDone ? 1 : Math.min(Math.max((ph - 0.8) / 0.2, 0), 1),
            }} />
          </>
        )}

        {/* 面板内容 */}
        <div style={{
          visibility: showContent ? 'visible' : 'hidden',
          height: contentSized ? 'auto' : '100%',
          display: 'flex',
          flexDirection: 'column',
        }}>
          {children}
        </div>
      </div>

      {/* Corner 高亮：随展开进度淡入（opacity 0→1） */}
      {hasStarted && (
        <>
          <span style={{
            position: 'absolute', top: -1, left: -1, zIndex: 30,
            width: CORNER_SIZE, height: CORNER_SIZE,
            borderTop: `1.5px solid ${WHITE}`, borderLeft: `1.5px solid ${WHITE}`,
            opacity: isDone ? 1 : cornerOpacity,
            pointerEvents: 'none',
          }} />
          <span style={{
            position: 'absolute', top: -1, right: -1, zIndex: 30,
            width: CORNER_SIZE, height: CORNER_SIZE,
            borderTop: `1.5px solid ${WHITE}`, borderRight: `1.5px solid ${WHITE}`,
            opacity: isDone ? 1 : cornerOpacity,
            pointerEvents: 'none',
          }} />
          <span style={{
            position: 'absolute', bottom: -1, left: -1, zIndex: 30,
            width: CORNER_SIZE, height: CORNER_SIZE,
            borderBottom: `1.5px solid ${WHITE}`, borderLeft: `1.5px solid ${WHITE}`,
            opacity: isDone ? 1 : cornerOpacity,
            pointerEvents: 'none',
          }} />
          <span style={{
            position: 'absolute', bottom: -1, right: -1, zIndex: 30,
            width: CORNER_SIZE, height: CORNER_SIZE,
            borderBottom: `1.5px solid ${WHITE}`, borderRight: `1.5px solid ${WHITE}`,
            opacity: isDone ? 1 : cornerOpacity,
            pointerEvents: 'none',
          }} />
        </>
      )}
    </div>
  );
}

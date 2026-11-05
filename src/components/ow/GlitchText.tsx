'use client';

import { ElementType, useEffect, useMemo, useRef, useState } from 'react';
import { sanitizeDisplayText } from '@/lib/safeText';

/**
 * GlitchText v5
 *
 * 行为：
 *  - 首次激活（active: false→true）：字符从 0 个开始向右展开 + 全程乱码，
 *    展开到 20% 进度时开始从左锁定真实字符，两种动画叠加。
 *  - 后续文字变化（active 保持 true）：仅做普通乱码解析动画，不缩短字符数。
 *  - active=false：清空显示，重置首次 flag。
 */

const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&*_-=+:.<>?/';

function randChar() {
  return CHARSET[Math.floor(Math.random() * CHARSET.length)];
}

/** 普通乱码：前 locked 个字符已锁定，其余随机 */
function makeGlitch(text: string, locked: number): string {
  let s = '';
  for (let i = 0; i < locked; i++) s += text[i];
  for (let i = locked; i < text.length; i++) s += randChar();
  return s;
}

/** Reveal 乱码：只显示 visible 个字符，前 locked 个锁定，其余随机 */
function makeReveal(text: string, locked: number, visible: number): string {
  let s = '';
  for (let i = 0; i < visible; i++) {
    s += i < locked ? text[i] : randChar();
  }
  return s;
}

interface GlitchTextProps {
  text: string;
  active?: boolean;
  /** 整个动画时长（ms），默认 600 */
  duration?: number;
  /** 乱码刷新间隔（ms），默认 40 */
  frameInterval?: number;
  className?: string;
  style?: React.CSSProperties;
  tag?: ElementType;
}

export function GlitchText({
  text,
  active = true,
  duration = 600,
  frameInterval = 40,
  className = '',
  style,
  tag: Tag = 'span',
}: GlitchTextProps) {
  const safeText = useMemo(() => sanitizeDisplayText(text), [text]);
  const [display, setDisplay] = useState<string>('');
  // 标记是否已经做过首次 reveal（active 首次变 true）
  const revealedRef = useRef(false);

  useEffect(() => {
    if (!active) {
      setDisplay('');
      revealedRef.current = false;
      return;
    }
    if (!safeText) { setDisplay(''); return; }

    const total = safeText.length;
    const isFirstReveal = !revealedRef.current;

    if (isFirstReveal) {
      // ── 首次激活：reveal + glitch 叠加 ──────────────────────────────
      revealedRef.current = true;

      // visible 在 duration 内从 0 → total（展开）
      // locked  在 [0.2×duration, 1.2×duration] 内从 0 → total（锁定，稍慢）
      const LOCK_START_RATIO = 0.2; // locked 相对于 duration 开始的比例
      const TOTAL_DUR = duration * 1.2;   // 整个动画总时长（稍长于纯乱码）

      const startTime = performance.now();
      setDisplay(''); // 从空字符串开始

      const id = setInterval(() => {
        const elapsed = performance.now() - startTime;

        const visible = Math.min(
          Math.floor((elapsed / duration) * total),
          total,
        );
        const lockElapsed = Math.max(elapsed - duration * LOCK_START_RATIO, 0);
        const locked = Math.min(
          Math.floor((lockElapsed / (TOTAL_DUR - duration * LOCK_START_RATIO)) * total),
          total,
        );

        if (visible >= total && locked >= total) {
          clearInterval(id);
          setDisplay(safeText);
          return;
        }

        setDisplay(makeReveal(safeText, locked, visible));
      }, frameInterval);

      return () => { clearInterval(id); };

    } else {
      // ── 后续文字变化：普通乱码解析 ──────────────────────────────────
      const charInterval = duration / total;
      let locked = 0;
      let lastLockTime = performance.now();

      setDisplay(makeGlitch(safeText, 0));

      const id = setInterval(() => {
        const now = performance.now();
        const newLocks = Math.floor((now - lastLockTime) / charInterval);

        if (newLocks > 0) {
          locked = Math.min(locked + newLocks, total);
          lastLockTime += newLocks * charInterval;
        }

        if (locked >= total) {
          clearInterval(id);
          setDisplay(safeText);
          return;
        }

        setDisplay(makeGlitch(safeText, locked));
      }, frameInterval);

      return () => { clearInterval(id); };
    }
  }, [active, safeText, duration, frameInterval]);

  const isolatedStyle: React.CSSProperties = {
    unicodeBidi: 'isolate',
    ...style,
  };

  // active=false：占位空格保持布局
  if (!active) return <Tag className={className} style={isolatedStyle} dir="auto">&nbsp;</Tag>;

  // display 为空（首帧还未设置）时的处理
  const shown = display !== '' ? display : (revealedRef.current ? makeGlitch(safeText, 0) : '');
  return <Tag className={className} style={isolatedStyle} dir="auto">{shown}</Tag>;
}

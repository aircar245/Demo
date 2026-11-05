import type { CSSProperties, ElementType } from 'react';
import { sanitizeDisplayText } from '@/lib/safeText';

interface GlitchTextProps {
  text: string;
  /** Retained for callers that also coordinate other visual effects. */
  active?: boolean;
  duration?: number;
  frameInterval?: number;
  className?: string;
  style?: CSSProperties;
  tag?: ElementType;
}

export function GlitchText({ text, className = '', style, tag: Tag = 'span' }: GlitchTextProps) {
  return (
    <Tag className={className} style={{ unicodeBidi: 'isolate', ...style }} dir="auto">
      {sanitizeDisplayText(text)}
    </Tag>
  );
}

'use client';

import { useEffect, type CSSProperties, type ReactNode } from 'react';
import styles from './PanelReveal.module.css';

interface PanelRevealProps {
  delay?: number;
  /** Let long forms determine panel height instead of requiring a sized parent. */
  contentSized?: boolean;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  onComplete?: () => void;
}

/** Keep the panel's final geometry available to the shared construction layer. */
export function PanelReveal({
  delay = 0,
  contentSized = false,
  children,
  className = '',
  style,
  onComplete,
}: PanelRevealProps) {
  useEffect(() => {
    if (!onComplete) return;
    const timer = window.setTimeout(onComplete, delay);
    return () => window.clearTimeout(timer);
  }, [delay, onComplete]);

  return (
    <div className={`relative ${styles.frame} ${className}`} style={{ ...style, overflow: 'visible' }}>
      <div className={contentSized ? styles.contentSized : styles.fixedSize}>
        <div className={styles.content} style={{ height: contentSized ? 'auto' : '100%' }}>
          {children}
        </div>
      </div>
      <span className={`${styles.corner} ${styles.topLeft}`} aria-hidden="true" />
      <span className={`${styles.corner} ${styles.topRight}`} aria-hidden="true" />
      <span className={`${styles.corner} ${styles.bottomLeft}`} aria-hidden="true" />
      <span className={`${styles.corner} ${styles.bottomRight}`} aria-hidden="true" />
    </div>
  );
}

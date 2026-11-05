'use client';

import { useEffect, useMemo, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeHighlight from 'rehype-highlight';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import { compileChallengeContent, createChallengeDocument } from '@/lib/challenge-content';

function InteractiveContent({ html }: { html: string }) {
  const frameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const getTheme = () => document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
    const syncTheme = () => frame.contentWindow?.postMessage({ type: 'cnss-content-theme', theme: getTheme() }, '*');
    const resize = (event: MessageEvent) => {
      // opaque origin 为 null，必须校验窗口来源，不能仅校验 origin。
      if (event.source !== frame.contentWindow || event.data?.type !== 'cnss-content-height') return;
      const height: unknown = event.data.height;
      if (typeof height !== 'number' || !Number.isFinite(height) || height < 0) return;
      frame.style.height = `${Math.min(20000, Math.max(64, Math.ceil(height)))}px`;
    };
    window.addEventListener('message', resize);
    frame.addEventListener('load', syncTheme);
    const themeObserver = new MutationObserver(syncTheme);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    // 复用当前页面的正文、KaTeX 和字体样式；不复制主站的任何脚本。
    const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
      .map(element => element.outerHTML).join('\n');
    frame.style.height = '150px';
    frame.srcdoc = createChallengeDocument(html, styles, getTheme());
    return () => {
      window.removeEventListener('message', resize);
      frame.removeEventListener('load', syncTheme);
      themeObserver.disconnect();
    };
  }, [html]);

  return (
    <iframe
      ref={frameRef}
      title="题目交互内容"
      sandbox="allow-scripts"
      referrerPolicy="no-referrer"
      className="block w-full border-0"
      style={{ height: 150, background: 'transparent' }}
    />
  );
}

export function ChallengeContent({ content }: { content: string }) {
  const compiled = useMemo(() => compileChallengeContent(content), [content]);
  if (compiled.interactive) return <InteractiveContent html={compiled.html} />;
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex, rehypeRaw, rehypeHighlight]}
    >
      {content}
    </ReactMarkdown>
  );
}

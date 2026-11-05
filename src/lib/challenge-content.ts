import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import rehypeStringify from 'rehype-stringify';

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkMath)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)
  .use(rehypeKatex)
  .use(rehypeHighlight)
  .use(rehypeStringify);

interface HtmlNode {
  type: string;
  tagName?: string;
  children?: readonly HtmlNode[];
}

function containsScript(node: HtmlNode): boolean {
  return node.tagName === 'script' || Boolean(node.children?.some(containsScript));
}

// 只解析语法树，不在主页面创建 DOM 或执行脚本。
export function compileChallengeContent(markdown: string) {
  const tree = processor.runSync(processor.parse(markdown));
  return { html: processor.stringify(tree), interactive: containsScript(tree) };
}

// 此代码运行在沙箱内，必须保持为可直接序列化的普通 JavaScript。
function contentRuntime() {
  let lastHeight = 0;
  let pending = false;
  function measure() {
    pending = false;
    if (!document.body) return;
    const height = Math.ceil(Math.max(document.body.getBoundingClientRect().height, document.body.scrollHeight));
    if (height !== lastHeight) {
      lastHeight = height;
      parent.postMessage({ type: 'cnss-content-height', height }, '*');
    }
  }
  function schedule() {
    if (!pending) {
      pending = true;
      requestAnimationFrame(measure);
    }
  }
  window.addEventListener('message', (event) => {
    if (event.source !== parent || event.data?.type !== 'cnss-content-theme') return;
    if (event.data.theme === 'dark' || event.data.theme === 'light') {
      document.documentElement.dataset.theme = event.data.theme;
    }
  });
  document.addEventListener('DOMContentLoaded', () => {
    new ResizeObserver(schedule).observe(document.body);
    new MutationObserver(schedule).observe(document.body, {
      childList: true, subtree: true, attributes: true, characterData: true,
    });
    schedule();
  });
  window.addEventListener('load', schedule);
  window.addEventListener('resize', schedule);
}

export function createChallengeDocument(html: string, styles: string, theme: 'light' | 'dark') {
  return `<!doctype html>
<html lang="zh-CN" data-theme="${theme}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' https: http:; style-src 'unsafe-inline' https: http:; img-src https: http: data: blob:; font-src https: http: data:; media-src https: http: data: blob:; connect-src https: http:; base-uri 'none'; form-action 'none'">
${styles}
<style>html, body { height: auto !important; min-height: 0 !important; background: transparent !important; } body { display: flow-root; margin: 0; overflow-wrap: anywhere; } img, video, canvas { max-width: 100%; }</style>
<script>(${contentRuntime.toString()})();</script>
</head>
<body class="prose-ow">${html}</body>
</html>`;
}

export type AutoJob = {
  key: Element | Text;
  id: string;
  element: Element;
  kind: 'frame' | 'rule' | 'detail' | 'native-text';
  after: string[];
  edge?: 'top' | 'right' | 'bottom' | 'left';
  text?: Text;
  ends?: number[];
};

type Edge = NonNullable<AutoJob['edge']>;
type ElementKind = Exclude<AutoJob['kind'], 'native-text'>;
type Visual = { kind: ElementKind; edge?: Edge };
type Context = { frame?: string; background?: string };

const IGNORE = '.sr-only, [data-swarm-ignore], [data-swarm-overlay], [data-swarm-glyph], script, style, template, noscript';
const ATOMIC = new Set([
  'audio', 'canvas', 'embed', 'iframe', 'img', 'input', 'meter', 'object',
  'picture', 'progress', 'select', 'textarea', 'video',
]);
const SVG_GEOMETRY = new Set(['path', 'rect', 'circle', 'ellipse', 'line', 'polygon', 'polyline']);
const SVG_ATOMIC = new Set(['image', 'text', 'use', 'foreignobject']);
const SVG_SKIP = new Set([
  'clippath', 'defs', 'desc', 'filter', 'lineargradient', 'marker', 'mask', 'metadata',
  'pattern', 'radialgradient', 'script', 'style', 'symbol', 'title',
]);
const EDGES: Edge[] = ['top', 'right', 'bottom', 'left'];
const SEGMENTER = typeof Intl.Segmenter === 'function'
  ? new Intl.Segmenter('zh', { granularity: 'grapheme' })
  : null;
let nextId = 0;

function alpha(color: string): number {
  if (!color || color === 'transparent' || color === 'none') return 0;
  const component = color.match(/\/\s*([\d.]+)(%)?\s*\)$/u)
    ?? color.match(/^(?:rgba|hsla)\(.+,\s*([\d.]+)(%)?\s*\)$/u);
  return component ? Number(component[1]) / (component[2] ? 100 : 1) : 1;
}

function hasBorder(style: CSSStyleDeclaration, edge: Edge): boolean {
  const type = style.getPropertyValue('border-' + edge + '-style');
  return type !== 'none' && type !== 'hidden'
    && parseFloat(style.getPropertyValue('border-' + edge + '-width')) > 0
    && alpha(style.getPropertyValue('border-' + edge + '-color')) > 0;
}

function classify(element: Element, style: CSSStyleDeclaration, rect: DOMRect, background?: string): Visual | undefined {
  if (element.localName === 'hr') return { kind: 'rule', edge: 'top' };
  const sides = EDGES.filter(edge => hasBorder(style, edge));
  const fill = style.backgroundImage !== 'none'
    || (alpha(style.backgroundColor) > 0 && style.backgroundColor !== background);
  const shadow = style.boxShadow !== 'none';
  const outline = style.outlineStyle !== 'none' && style.outlineStyle !== 'hidden'
    && parseFloat(style.outlineWidth) > 0 && alpha(style.outlineColor) > 0;
  if (!fill && !sides.length && !shadow && !outline) return;
  if (!fill && sides.length === 1 && !shadow && !outline) return { kind: 'rule', edge: sides[0] };

  const short = Math.min(rect.width, rect.height), long = Math.max(rect.width, rect.height);
  if (short <= 4 && long >= 12 && long >= short * 4) return { kind: 'rule' };
  if (long <= 36 && element.childNodes.length === 0) return { kind: 'detail' };
  return { kind: 'frame' };
}

function previousVisual(element: Element, previous: Map<Element | Text, string>): Visual | undefined {
  if (!element.hasAttribute('data-swarm-auto')) return;
  const match = previous.get(element)?.match(/^swarm-auto-(frame|rule|detail)-(?:\d+)(?:-(top|right|bottom|left))?$/u);
  if (match) return { kind: match[1] as ElementKind, edge: match[2] as Edge | undefined };
}

function textEnds(value: string): number[] {
  if (SEGMENTER) return Array.from(SEGMENTER.segment(value), part => part.index + part.segment.length);
  let end = 0;
  return Array.from(value, glyph => (end += glyph.length));
}

/**
 * Measure the current page without changing React's nodes or layout. Offscreen
 * boxes are included so the controller can start them when their scroller moves.
 */
export function collectAutoJobs(root: HTMLElement, previous: Map<Element | Text, string>): AutoJob[] {
  const jobs: AutoJob[] = [];
  const range = root.ownerDocument.createRange();

  function add(key: Element | Text, element: Element, visual: { kind: AutoJob['kind']; edge?: Edge }, frame?: string) {
    const id = previous.get(key) ?? ('swarm-auto-' + visual.kind + '-' + ++nextId + (visual.edge ? '-' + visual.edge : ''));
    const job = { key, id, element, after: frame ? [frame] : [], ...visual };
    previous.set(key, id);
    jobs.push(job);
    return job;
  }

  function collectSvg(svg: Element, frame?: string) {
    const before = jobs.length;
    function walk(element: Element) {
      const tag = element.localName.toLowerCase();
      if (SVG_SKIP.has(tag) || element.matches(IGNORE)) return;
      const style = getComputedStyle(element);
      if (style.display === 'none' || Number(style.opacity) === 0) return;
      if (SVG_GEOMETRY.has(tag) || SVG_ATOMIC.has(tag)) {
        if (element.hasAttribute('data-swarm-kind')) return;
        const existing = previousVisual(element, previous);
        if (!existing && style.visibility !== 'visible') return;
        const box = element.getBoundingClientRect();
        const hasStroke = alpha(style.stroke) > 0 && parseFloat(style.strokeWidth) > 0 && Number(style.strokeOpacity) > 0;
        const hasFill = alpha(style.fill) > 0 && Number(style.fillOpacity) > 0;
        const hasPaint = existing || hasStroke || hasFill || SVG_ATOMIC.has(tag);
        if (hasPaint && (box.width > 0 || box.height > 0)) add(element, element, { kind: 'detail' }, frame);
        return;
      }
      for (const child of element.children) walk(child);
    }
    for (const child of svg.children) walk(child);
    if (before === jobs.length && !svg.hasAttribute('data-swarm-kind')) add(svg, svg, { kind: 'detail' }, frame);
  }

  function walk(element: Element, context: Context) {
    if (element.matches(IGNORE)) return;
    const style = getComputedStyle(element);
    if (style.display === 'none' || style.contentVisibility === 'hidden' || Number(style.opacity) === 0) return;
    const existing = previousVisual(element, previous);
    const visible = style.visibility === 'visible' || !!existing;
    const bounds = element.getBoundingClientRect();
    const hasBox = bounds.width > 0 && bounds.height > 0;
    const kind = element.getAttribute('data-swarm-kind');
    const tag = element.localName.toLowerCase();
    const atomic = ATOMIC.has(tag) || element.matches('[role="img"], [contenteditable="true"]');

    if (tag === 'svg') {
      if (hasBox && visible) collectSvg(element, context.frame);
      return;
    }
    if (atomic) {
      if (hasBox && visible && !kind) add(element, element, { kind: 'detail' }, context.frame);
      return;
    }

    let frame = context.frame;
    if (hasBox && kind === 'frame') {
      const authored = element.getAttribute('data-swarm-id');
      if (authored) frame = authored;
    } else if (hasBox && visible && !kind && !element.hasAttribute('data-swarm-cell')) {
      const visual = existing ?? classify(element, style, bounds, context.background);
      if (visual) {
        const job = add(element, element, visual, frame);
        if (job.kind === 'frame') frame = job.id;
      }
    }

    if (kind === 'text' || kind === 'align') return;
    const background = visible && hasBox && alpha(style.backgroundColor) === 1 && style.backgroundImage === 'none'
      ? style.backgroundColor
      : context.background;
    const childContext = { frame, background };
    for (const child of element.childNodes) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        walk(child as Element, childContext);
      } else if (child.nodeType === Node.TEXT_NODE && visible) {
        const node = child as Text;
        if (!node.data.trim()) continue;
        range.selectNodeContents(node);
        if (!Array.from(range.getClientRects()).some(box => box.width > 0 && box.height > 0)) continue;
        const job: AutoJob = add(node, element, { kind: 'native-text' }, frame);
        job.text = node;
        job.ends = textEnds(node.data);
      }
    }
  }

  let background: string | undefined;
  for (let ancestor = root.parentElement; ancestor; ancestor = ancestor.parentElement) {
    const style = getComputedStyle(ancestor);
    if (style.backgroundImage !== 'none' || (alpha(style.backgroundColor) > 0 && alpha(style.backgroundColor) < 1)) break;
    if (alpha(style.backgroundColor) === 1) {
      background = style.backgroundColor;
      break;
    }
  }
  for (const child of root.children) walk(child, { background });
  return jobs;
}

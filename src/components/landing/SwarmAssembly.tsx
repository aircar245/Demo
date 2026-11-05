'use client';

import { type ReactNode, useLayoutEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { collectAutoJobs } from './collectSwarmJobs';
import styles from './SwarmAssembly.module.css';

const TOOLS = [
  ['Mia', '#6084ff'], ['Noah', '#d568c3'], ['Ava', '#24b58a'], ['Leo', '#ff8052'],
  ['Ivy', '#a07aff'], ['Kai', '#27b4c7'], ['Luna', '#e7a62d'], ['Finn', '#f76692'],
] as const;

type Kind = 'frame' | 'rule' | 'text' | 'align' | 'content' | 'blocks' | 'detail' | 'native-text' | 'field-text';
type Tool = 'arrow' | 'crosshair' | 'caret';
type Point = { x: number; y: number };
type Job = {
  key: Node;
  id: string;
  element: Element;
  kind: Kind;
  after: string[];
  parts: HTMLElement[];
  state: 'waiting' | 'active' | 'done';
  drawn: number;
  offset: number;
  automatic?: boolean;
  text?: Text;
  ends?: number[];
  ink?: Range;
  source?: string;
  fieldColor?: string;
  edge?: 'top' | 'right' | 'bottom' | 'left';
};
type Agent = Point & {
  name: string;
  color: string;
  angle: number;
  origin: Point;
  since: number;
  phase: 'travel' | 'press' | 'draw' | 'parts' | 'align' | 'release';
  job?: Job;
};

const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const mix = (a: number, b: number, progress: number) => a + (b - a) * progress;
const smooth = (progress: number) => progress * progress * (3 - 2 * progress);
const isText = (kind: Kind) => kind === 'text' || kind === 'align';
const hasParts = (job: Job) => Boolean(job.ends?.length || job.parts.length);
const partCount = (job: Job) => job.ends?.length ?? job.parts.length;
const textSegmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter('zh', { granularity:'grapheme' }) : null;

function makeJob(fields: Omit<Job, 'state' | 'drawn' | 'offset'>): Job {
  return { ...fields, state:'waiting', drawn:0, offset:0 };
}

function collectJobs(root: HTMLElement, ids: Map<Element|Text, string>, highlight: Highlight | null): Job[] {
  const authored = Array.from(root.querySelectorAll<HTMLElement>('[data-swarm-id][data-swarm-kind]'), element => {
    const kind = element.dataset.swarmKind as Kind;
    return makeJob({
      key: element,
      id: element.dataset.swarmId!,
      element,
      kind,
      after: (element.dataset.swarmAfter ?? '').split(/\s+/u).filter(Boolean),
      source: isText(kind) ? element.textContent : undefined,
      parts: kind === 'blocks' || isText(kind)
        ? Array.from(element.querySelectorAll<HTMLElement>(kind === 'blocks' ? '[data-swarm-cell]' : '[data-swarm-glyph]'))
        : [],
    });
  });
  const discovered = collectAutoJobs(root, ids).flatMap(entry => {
    if (entry.kind === 'native-text' && !highlight) return [];
    return [makeJob({ ...entry, parts:[], automatic:true, source:entry.text?.data })];
  });
  const fields = discovered.flatMap(job => {
    const field = job.element;
    const placeholder = field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement
      ? field.getAttributeNode('placeholder') : null;
    if (job.kind !== 'detail' || !placeholder?.value.trim() || (field as HTMLInputElement).value) return [];
    const source = placeholder.value;
    let end = 0;
    const ends = (textSegmenter ? Array.from(textSegmenter.segment(source), item=>item.segment) : Array.from(source))
      .map(glyph => end += glyph.length);
    return [makeJob({
      key:placeholder, id:job.id+'-label', element:field, kind:'field-text', after:[job.id],
      parts:[], source, ends, fieldColor:getComputedStyle(field,'::placeholder').color,
    })];
  });
  return [...authored, ...discovered, ...fields];
}

function trace(ctx: CanvasRenderingContext2D, from: Point, to: Point, color: string, width = 1) {
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
}

function selection(ctx: CanvasRenderingContext2D, origin: Point, tip: Point, color: string, fill = false) {
  const width = tip.x - origin.x, height = tip.y - origin.y;
  if (fill) {
    ctx.fillStyle = '#7b8da51b';
    ctx.fillRect(origin.x, origin.y, width, height);
  }
  ctx.lineWidth = 1;
  ctx.strokeStyle = color;
  ctx.strokeRect(origin.x, origin.y, width, height);
  ctx.fillStyle = '#f4f7ff';
  for (const x of [origin.x, tip.x]) {
    for (const y of [origin.y, tip.y]) {
      ctx.fillRect(x - 2, y - 2, 4, 4);
      ctx.strokeRect(x - 2, y - 2, 4, 4);
    }
  }
}

function badge(ctx: CanvasRenderingContext2D, text: string, point: Point, color: string) {
  ctx.font = '600 10px system-ui, sans-serif';
  const width = ctx.measureText(text).width + 10;
  const x = clamp(point.x, 2, window.innerWidth - width - 2);
  const y = clamp(point.y, 2, window.innerHeight - 17);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, width, 15);
  ctx.fillStyle = '#080a12';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + 5, y + 7.5);
}

function drawPointer(ctx: CanvasRenderingContext2D, agent: Agent, tool: Tool, pressed = false, idle = false) {
  const { x, y, color, name } = agent;
  if (x < -25 || x > innerWidth + 25 || y < -25 || y > innerHeight + 25) return;
  ctx.save();
  if (idle) ctx.globalAlpha = .5;
  ctx.translate(x, y);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (pressed) {
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.beginPath();
  if (tool === 'crosshair') {
    ctx.moveTo(-6, 0); ctx.lineTo(6, 0);
    ctx.moveTo(0, -6); ctx.lineTo(0, 6);
  } else if (tool === 'caret') {
    ctx.moveTo(-3, -6); ctx.lineTo(3, -6);
    ctx.moveTo(0, -6); ctx.lineTo(0, 6);
    ctx.moveTo(-3, 6); ctx.lineTo(3, 6);
  } else {
    ctx.moveTo(0, 0); ctx.lineTo(3, 17); ctx.lineTo(7, 11); ctx.lineTo(14, 9);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }
  ctx.strokeStyle = '#f4f7ff';
  ctx.lineWidth = 2.75;
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
  if (!idle) badge(ctx, name, { x: x + 10, y: y + 12 }, color);
}

function drawRuler(ctx: CanvasRenderingContext2D, origin: Point, color: string) {
  const height = innerHeight, width = innerWidth;
  ctx.fillStyle = '#252933';
  ctx.fillRect(0, 0, 15, height);
  ctx.fillRect(0, 0, width, 15);
  for (let x = 20; x < width; x += 10) {
    trace(ctx, { x, y: 15 }, { x, y: x % 50 ? 11 : 7 }, '#838a9a');
  }
  for (let y = 20; y < height; y += 10) {
    trace(ctx, { x: 15, y }, { x: y % 50 ? 11 : 7, y }, '#838a9a');
  }
  trace(ctx, { x: origin.x, y: 15 }, { x: origin.x, y: height }, '#f369b9b0');
  trace(ctx, { x: 15, y: origin.y }, { x: width, y: origin.y }, '#f369b9b0');
  badge(ctx, '对齐', { x: origin.x + 7, y: origin.y - 18 }, color);
}

function reveal(job: Job, count: number) {
  while (job.drawn < Math.min(count, partCount(job))) {
    job.parts[job.drawn]?.setAttribute('data-swarm-drawn', '');
    if (job.ink && job.text) {
      job.ink.setStart(job.text, Math.min(job.text.length, job.ends![job.drawn]));
    }
    job.drawn++;
  }
}

function applyPending(job: Job, highlight: Highlight | null) {
  if (job.text && highlight) {
    const ink = document.createRange();
    ink.selectNodeContents(job.text);
    highlight.add(ink);
    job.ink = ink;
  } else if (job.automatic) {
    job.element.setAttribute('data-swarm-auto', job.kind);
  } else if (job.kind === 'field-text') {
    job.element.setAttribute('data-swarm-field-ink', '');
  }
}

function reset(job: Job, highlight: Highlight | null) {
  if (job.ink) highlight?.delete(job.ink);
  if (job.kind === 'align') (job.element as HTMLElement).style.removeProperty('--swarm-offset');
  job.element.removeAttribute('data-swarm-done');
  if (job.automatic && job.kind !== 'native-text') job.element.removeAttribute('data-swarm-auto');
  if (job.kind === 'field-text') job.element.removeAttribute('data-swarm-field-ink');
  for (const part of job.parts) part.removeAttribute('data-swarm-drawn');
}

function complete(job: Job, highlight: Highlight | null) {
  reveal(job, partCount(job));
  if (job.ink) highlight?.delete(job.ink);
  job.state = 'done';
  job.offset = 0;
  if (job.kind === 'align') (job.element as HTMLElement).style.removeProperty('--swarm-offset');
  if (job.automatic && job.kind !== 'native-text') job.element.removeAttribute('data-swarm-auto');
  if (job.kind === 'field-text') job.element.removeAttribute('data-swarm-field-ink');
  if (!job.automatic && job.kind !== 'field-text') job.element.setAttribute('data-swarm-done', '');
}

function activePhase(agent: Agent, phase: Agent['phase'], now: number) {
  agent.phase = phase;
  agent.since = now;
}

function glyphRect(job: Job, index: number): DOMRect {
  if (job.text && job.ends) {
    const range = document.createRange();
    range.setStart(job.text, Math.min(job.text.length, job.ends[index - 1] ?? 0));
    range.setEnd(job.text, Math.min(job.text.length, job.ends[index] ?? job.text.length));
    return Array.from(range.getClientRects()).at(-1) ?? job.element.getBoundingClientRect();
  }
  return job.parts[index]?.getBoundingClientRect() ?? job.element.getBoundingClientRect();
}

function drawFieldInk(ctx: CanvasRenderingContext2D, job: Job, rect: DOMRect, index: number): Point {
  const font = getComputedStyle(job.element);
  const x = rect.left + parseFloat(font.borderLeftWidth) + parseFloat(font.paddingLeft);
  const y = job.element instanceof HTMLTextAreaElement
    ? rect.top + parseFloat(font.borderTopWidth) + parseFloat(font.paddingTop) + parseFloat(font.fontSize) / 2
    : rect.top + rect.height / 2;
  const text = job.source ?? '';
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.left, rect.top, rect.width, rect.height);
  ctx.clip();
  ctx.font = `${font.fontWeight} ${font.fontSize} ${font.fontFamily}`;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = job.fieldColor || font.color;
  if (job.drawn) ctx.fillText(text.slice(0, job.ends![job.drawn-1]), x, y);
  const advance = ctx.measureText(text.slice(0, job.ends![index])).width;
  ctx.restore();
  return { x:Math.min(rect.right-2, x+advance), y };
}

function svgStroke(ctx: CanvasRenderingContext2D, element: Element, amount: number, color: string): Point | undefined {
  if (!(element instanceof SVGGeometryElement)) return;
  const matrix = element.getScreenCTM();
  if (!matrix) return;
  const length = element.getTotalLength();
  if (!length) return;
  const pointAt = (offset: number) => element.getPointAtLength(length * offset).matrixTransform(matrix);
  const count = Math.max(1, Math.ceil(amount * 24));
  let previous = pointAt(0);
  for (let index = 1; index <= count; index++) {
    const next = pointAt(amount * index / count);
    trace(ctx, previous, next, color, 1.25);
    previous = next;
  }
  return previous;
}

function perform(ctx: CanvasRenderingContext2D, agent: Agent, job: Job, now: number, highlight: Highlight | null) {
  if (job.kind === 'field-text' && (document.activeElement === job.element || (job.element as HTMLInputElement).value)) {
    complete(job, highlight);
    agent.job = undefined;
    return;
  }
  const rect = job.element.getBoundingClientRect();
  let start = { x: rect.left, y: rect.top };
  let end = { x: rect.right, y: rect.bottom };
  if (job.kind === 'native-text') {
    const glyph = glyphRect(job, Math.min(job.drawn, partCount(job)-1));
    start = { x:glyph.left, y:glyph.top };
    end = { x:glyph.right, y:glyph.bottom };
  } else if (job.kind === 'rule') {
    if (job.edge === 'bottom') start.y = rect.bottom;
    if (job.edge === 'right') start.x = rect.right;
    if (job.edge === 'left' || job.edge === 'right' || (!job.edge && rect.height > rect.width)) end.x = start.x;
    else end.y = start.y;
  } else if (job.kind === 'detail' && job.element instanceof SVGGeometryElement) {
    const matrix = job.element.getScreenCTM();
    if (matrix && job.element.getTotalLength()) start = job.element.getPointAtLength(0).matrixTransform(matrix);
  } else if (job.kind === 'frame' || job.kind === 'content') {
    // Trace only the portion of a tall frame in this viewport.
    start = { x:Math.max(0, start.x), y:Math.max(0, start.y) };
    end = { x:Math.min(innerWidth-1, end.x), y:Math.min(innerHeight-1, end.y) };
  }
  const time = now - agent.since;
  let position = start;
  let tool: Tool = 'crosshair';
  let pressed = false;

  switch (agent.phase) {
    case 'travel': {
      const duration = clamp(Math.hypot(start.x - agent.origin.x, start.y - agent.origin.y) * .24, 55, 145);
      const progress = smooth(clamp(time / duration));
      position = {
        x: mix(agent.origin.x, start.x, progress),
        y: mix(agent.origin.y, start.y, progress) + Math.sin(progress * Math.PI) * Math.cos(agent.angle) * 31,
      };
      tool = 'arrow';
      if (progress === 1) activePhase(agent, 'press', now);
      break;
    }
    case 'press':
      pressed = true;
      if (time >= 22) {
        agent.origin = start;
        activePhase(agent, hasParts(job) && !isText(job.kind) ? 'parts' : 'draw', now);
      }
      break;
    case 'draw': {
      const duration = job.kind === 'frame' ? clamp(100 + rect.width * .14, 130, 260)
        : job.kind === 'rule' ? clamp(Math.max(rect.width, rect.height) * .21, 70, 195)
        : isText(job.kind) ? 60 : 55;
      const linear = clamp(time / duration);
      const progress = smooth(linear);
      position = { x: mix(start.x, end.x, progress), y: mix(start.y, end.y, progress) };
      if (job.kind === 'frame') {
        selection(ctx, start, position, agent.color, true);
        if (rect.width > 220 && progress > .15) {
          const measure = Math.round(position.x - start.x) + ' × ' + Math.round(position.y - start.y);
          badge(ctx, measure, { x: position.x + 8, y: position.y - 18 }, agent.color);
        }
      } else if (job.kind === 'rule') {
        trace(ctx, start, position, agent.color, 1.5);
      } else if (job.kind === 'detail') {
        const tip = svgStroke(ctx, job.element, progress, agent.color);
        if (tip) position = tip;
        else selection(ctx, start, position, agent.color);
      } else {
        const height = isText(job.kind) ? Math.min(45, rect.height) : rect.height;
        position.y = start.y + height * progress;
        selection(ctx, start, position, agent.color);
      }
      pressed = true;
      if (linear === 1) {
        if (hasParts(job)) {
          agent.origin = position;
          activePhase(agent, 'parts', now);
        }
        else {
          complete(job, highlight);
          activePhase(agent, 'release', now);
        }
      }
      break;
    }
    case 'parts': {
      const cell = job.kind === 'blocks';
      const glyph = glyphRect(job, job.drawn);
      const target = job.kind === 'field-text' ? drawFieldInk(ctx, job, rect, job.drawn)
        : { x:cell ? glyph.left + glyph.width/2 : glyph.right, y:glyph.top+glyph.height/2 };
      const distance = Math.hypot(target.x-agent.origin.x, target.y-agent.origin.y);
      const step = clamp(distance * .27, cell ? 14 : job.kind === 'align' ? 20 : 10, 82);
      const linear = clamp(time / step);
      const progress = smooth(linear);
      position = { x:mix(agent.origin.x,target.x,progress), y:mix(agent.origin.y,target.y,progress) };
      tool = cell ? 'crosshair' : 'caret';
      pressed = linear > .66;
      if (cell && pressed) {
        selection(ctx, { x:glyph.left, y:glyph.top }, { x:glyph.right, y:glyph.bottom }, agent.color);
      }
      if (linear === 1) {
        // One paint commit per arrival, even after an interrupted animation frame.
        reveal(job, job.drawn+1);
        agent.origin = target;
        if (job.drawn === partCount(job)) {
          if (job.kind !== 'align') complete(job, highlight);
          activePhase(agent, job.kind === 'align' ? 'align' : 'release', now);
        } else activePhase(agent, 'parts', now);
      }
      break;
    }
    case 'align': {
      const progress = clamp((time-55) / 215);
      const actualX = rect.left - job.offset;
      const inset = Math.max(0, Math.min(12, innerWidth - rect.right + job.offset - 4));
      job.offset = progress < .25 ? inset * smooth(progress / .25) : inset * (1 - smooth((progress - .25) / .75));
      (job.element as HTMLElement).style.setProperty('--swarm-offset', job.offset + 'px');
      drawRuler(ctx, { x: actualX, y: rect.top }, agent.color);
      selection(ctx, { x: actualX + job.offset, y: rect.top }, { x: actualX + job.offset + rect.width, y: rect.bottom }, agent.color);
      const arrival = smooth(clamp(time / 55));
      position = { x:mix(agent.origin.x,actualX+job.offset+10,arrival), y:mix(agent.origin.y,rect.top+7,arrival) };
      tool = 'arrow';
      pressed = progress > .1 && progress < .9;
      if (progress === 1) activePhase(agent, 'release', now);
      break;
    }
    case 'release':
      position = { x: agent.x, y: agent.y };
      tool = isText(job.kind) ? 'caret' : 'arrow';
      if (time >= 35) {
        if (job.state !== 'done') complete(job, highlight);
        agent.job = undefined;
      }
      break;
  }
  Object.assign(agent, position);
  drawPointer(ctx, agent, tool, pressed);
}

function visibleJob(job: Job): boolean {
  let rect = job.ink?.getBoundingClientRect() ?? job.element.getBoundingClientRect();
  if (job.kind === 'rule' && job.edge) {
    if (job.edge === 'left' || job.edge === 'right') rect = new DOMRect(rect[job.edge], rect.y, 0, rect.height);
    else rect = new DOMRect(rect.x, rect[job.edge], rect.width, 0);
  }
  if ((!rect.width && !rect.height) || rect.bottom < 0 || rect.top >= innerHeight || rect.right < 0 || rect.left >= innerWidth) return false;
  for (let parent = job.element.parentElement; parent; parent = parent.parentElement) {
    const style = getComputedStyle(parent);
    if (!/(auto|scroll|hidden|clip)/.test(style.overflowX + ' ' + style.overflowY)) continue;
    const clip = parent.getBoundingClientRect();
    if (/(auto|scroll|hidden|clip)/.test(style.overflowY) && (rect.bottom < clip.top || rect.top > clip.bottom)) return false;
    if (/(auto|scroll|hidden|clip)/.test(style.overflowX) && (rect.right < clip.left || rect.left > clip.right)) return false;
  }
  return true;
}

function needsRescan(records: MutationRecord[]): boolean {
  return records.some(record => {
    const node = record.target instanceof Element ? record.target : record.target.parentElement;
    if (!node || node.closest('[data-swarm-ignore]')) return false;
    if (record.type !== 'attributes' || record.attributeName !== 'style') return true;
    const shown = (value: string | null) => !/(?:opacity:\s*0\s*(?:;|$)|display:\s*none|visibility:\s*hidden)/.test(value ?? '');
    return shown(record.oldValue) !== shown(node.getAttribute('style'));
  });
}

export function SwarmAssembly({ navigation, children }: { navigation: ReactNode; children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pathname = usePathname();

  useLayoutEffect(() => {
    const root = rootRef.current, canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    root?.removeAttribute('data-swarm-boot');
    if (!root || !canvas || !ctx) return;

    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const highlight = typeof Highlight !== 'undefined' && CSS.highlights ? new Highlight() : null;
    if (highlight) CSS.highlights.set('swarm-pending', highlight);
    const ids = new Map<Element|Text, string>();
    let jobs: Job[] = [], agents: Agent[] = [];
    let byId = new Map<string,Job>();
    let frame = 0, startTime = 0, width = 0, height = 0, density = 0;
    let skipped = false, dirty = false;

    function finish(allowNewJobs: boolean) {
      cancelAnimationFrame(frame);
      frame = 0;
      skipped = !allowNewJobs;
      if (skipped) for (const job of jobs) complete(job, highlight);
      for (const agent of agents) agent.job = undefined;
      root!.removeAttribute('data-swarm-running');
      ctx!.clearRect(0, 0, width, height);
    }

    function fitCanvas() {
      const w = canvas!.clientWidth, h = canvas!.clientHeight, dpr = Math.min(devicePixelRatio || 1, 2);
      if (width === w && height === h && density === dpr) return;
      width = w; height = h; density = dpr;
      canvas!.width = Math.round(width * dpr);
      canvas!.height = Math.round(height * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function scan() {
      dirty = false;
      const previous = new Map(jobs.map(job => [job.key,job]));
      jobs = collectJobs(root!, ids, highlight).map(job => {
        const old = previous.get(job.key);
        if (old && old.kind === job.kind && old.source === job.source &&
            old.parts.length === job.parts.length && old.parts.every((part,index)=>part===job.parts[index])) {
          previous.delete(job.key);
          old.after = job.after;
          return old;
        }
        if (old) {
          reset(old, highlight);
          previous.delete(job.key);
          for (const agent of agents) if (agent.job === old) agent.job = undefined;
        }
        applyPending(job, highlight);
        return job;
      });
      for (const job of previous.values()) {
        reset(job, highlight);
        for (const agent of agents) if (agent.job === job) agent.job = undefined;
      }
      for (const key of ids.keys()) if (!key.isConnected) ids.delete(key);
      byId = new Map(jobs.map(job => [job.id,job]));
      if (jobs.some(job => job.state !== 'done')) {
        root!.setAttribute('data-swarm-running', '');
      }
    }

    function tick(now: number) {
      frame = 0;
      if (skipped) return;
      if (dirty) scan();
      fitCanvas();
      ctx!.clearRect(0, 0, width, height);
      const intro = now - startTime < 150 && scrollY < 8;
      if (intro) {
        const progress = smooth(clamp((now - startTime) / 145));
        const center = { x: width / 2, y: height * .45 };
        badge(ctx!, 'CNSS / 2026', { x: center.x - 35, y: center.y - 8 }, '#a1adbf');
        for (const agent of agents) {
          const angle = agent.angle + (now - startTime) * .005;
          agent.x = mix(agent.origin.x, center.x + Math.cos(angle) * 78, progress);
          agent.y = mix(agent.origin.y, center.y + Math.sin(angle) * 44, progress);
          drawPointer(ctx!, agent, 'arrow');
        }
        frame = requestAnimationFrame(tick);
        return;
      }

      for (const agent of agents) {
        const job = agent.job;
        if (job && job.state !== 'done' && !visibleJob(job)) {
          job.state = 'waiting';
          agent.job = undefined;
        }
      }
      const available = agents.some(agent => !agent.job)
        ? jobs.filter(job => job.state === 'waiting'
            && job.after.every(id => {
              const parent = byId.get(id);
              return !parent || parent.state === 'done';
            })
            && visibleJob(job))
          .map(job => ({ job, rect:job.element.getBoundingClientRect() }))
        : [];

      let worked = false;
      for (const agent of agents) {
        if (!agent.job && available.length) {
          let best = 0, bestDistance = Infinity;
          for (const [index, candidate] of available.entries()) {
            const { left, top, right, bottom } = candidate.rect;
            const distance = Math.hypot(agent.x-clamp(agent.x,left,right), agent.y-clamp(agent.y,top,bottom));
            if (distance < bestDistance) {best = index;bestDistance = distance;}
          }
          const [{job}] = available.splice(best,1);
          job.state = 'active';
          agent.job = job;
          agent.origin = { x: agent.x, y: agent.y };
          activePhase(agent, 'travel', now);
        }
        const job = agent.job;
        if (job) {
          worked = true;
          perform(ctx!, agent, job, now, highlight);
        }
      }

      if (jobs.every(job => job.state === 'done') && agents.every(agent => !agent.job)) {
        finish(true);
        return;
      }
      if (worked) {
        frame = requestAnimationFrame(tick);
        return;
      }

    }

    function start() {
      cancelAnimationFrame(frame);
      frame = 0;
      for (const job of jobs) reset(job, highlight);
      jobs = [];
      if (motion.matches) {finish(false);return;}
      skipped = false;
      fitCanvas();
      startTime = performance.now();
      const count = width < 640 ? 6 : TOOLS.length;
      agents = TOOLS.slice(0, count).map(([name, color], index) => {
        const angle = index / count * Math.PI * 2;
        const x = width * (.5 + Math.cos(angle) * .4);
        const y = height * (.45 + Math.sin(angle) * .31);
        return { name, color, x, y, origin: { x, y }, angle, since: startTime, phase: 'travel' };
      });
      scan();
      frame = requestAnimationFrame(tick);
    }

    function wake() {
      if (!skipped && !frame) frame = requestAnimationFrame(tick);
    }

    function onResize() {
      dirty = true;
      wake();
    }

    function respectMotionPreference() {
      if (motion.matches) finish(false);
      else start();
    }

    function respectKeyboardFocus(event: KeyboardEvent) {
      if (event.key === 'Tab' && root!.hasAttribute('data-swarm-running')) finish(false);
    }

    const observer = new MutationObserver(records => {
      if (skipped || !needsRescan(records)) return;
      // Mutation observers run before the next paint, so newly inserted content
      // joins the same construction queue before it is displayed.
      scan();
      wake();
    });
    start();
    observer.observe(root, {
      subtree:true, childList:true, characterData:true, attributes:true, attributeOldValue:true,
      attributeFilter:['class','style','hidden','open','placeholder','aria-expanded'],
    });
    window.addEventListener('scroll', wake, { passive:true, capture:true });
    window.addEventListener('resize', onResize);
    document.addEventListener('keydown', respectKeyboardFocus);
    motion.addEventListener('change', respectMotionPreference);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      if (highlight) CSS.highlights.delete('swarm-pending');
      root.removeAttribute('data-swarm-running');
      for (const job of jobs) reset(job, highlight);
      window.removeEventListener('scroll', wake, true);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('keydown', respectKeyboardFocus);
      motion.removeEventListener('change', respectMotionPreference);
    };
  }, [pathname]);

  return (
    <div ref={rootRef} className={styles.assembly} data-swarm-boot="">
      {/* Keep the custom highlight rule intact through the build CSS optimizer. */}
      <style>{'::highlight(swarm-pending){color:transparent;-webkit-text-fill-color:transparent;text-shadow:none;text-decoration-color:transparent}'}</style>
      {navigation}
      {children}
      <canvas ref={canvasRef} className={styles.canvas} data-swarm-ignore aria-hidden="true" />
    </div>
  );
}

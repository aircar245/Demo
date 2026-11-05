'use client';

import { type ReactNode, useEffect, useLayoutEffect, useRef } from 'react';
import styles from './SwarmAssembly.module.css';

const TOOLS = [
  ['Mia', '#6084ff'], ['Noah', '#d568c3'], ['Ava', '#24b58a'], ['Leo', '#ff8052'],
  ['Ivy', '#a07aff'], ['Kai', '#27b4c7'], ['Luna', '#e7a62d'], ['Finn', '#f76692'],
] as const;

type Kind = 'frame' | 'rule' | 'text' | 'align' | 'content' | 'blocks';
type Tool = 'arrow' | 'crosshair' | 'caret';
type Point = { x: number; y: number };
type Job = {
  id: string;
  element: HTMLElement;
  kind: Kind;
  after: string[];
  parts: HTMLElement[];
  state: 'waiting' | 'active' | 'done';
  drawn: number;
  offset: number;
};
type Agent = Point & {
  name: string;
  color: string;
  angle: number;
  origin: Point;
  since: number;
  phase: 'travel' | 'press' | 'draw' | 'type' | 'align' | 'release';
  job?: Job;
};
type Props = {
  children: ReactNode;
  onReady: () => void;
  onReplay: () => void;
};

const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const mix = (a: number, b: number, progress: number) => a + (b - a) * progress;
const smooth = (progress: number) => progress * progress * (3 - 2 * progress);
const isText = (kind: Kind) => kind === 'text' || kind === 'align';

function collectJobs(root: HTMLElement): Job[] {
  return Array.from(root.querySelectorAll<HTMLElement>('[data-swarm-id][data-swarm-kind]'), element => {
    const kind = element.dataset.swarmKind as Kind;
    return {
      id: element.dataset.swarmId!,
      element,
      kind,
      after: (element.dataset.swarmAfter ?? '').split(/\s+/u).filter(Boolean),
      parts: Array.from(element.querySelectorAll<HTMLElement>(
        kind === 'blocks' ? '[data-swarm-cell]' : '[data-swarm-glyph]',
      )),
      state: 'waiting',
      drawn: 0,
      offset: 0,
    };
  });
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
  while (job.drawn < Math.min(count, job.parts.length)) {
    job.parts[job.drawn].setAttribute('data-swarm-drawn', '');
    job.drawn++;
  }
}

function reset(job: Job) {
  if (job.kind === 'align') job.element.style.removeProperty('--swarm-offset');
  job.element.removeAttribute('data-swarm-done');
  for (const part of job.parts) part.removeAttribute('data-swarm-drawn');
}

function complete(job: Job) {
  reveal(job, job.parts.length);
  job.state = 'done';
  job.offset = 0;
  if (job.kind === 'align') job.element.style.removeProperty('--swarm-offset');
  job.element.setAttribute('data-swarm-done', '');
}

function activePhase(agent: Agent, phase: Agent['phase'], now: number) {
  agent.phase = phase;
  agent.since = now;
}

function perform(ctx: CanvasRenderingContext2D, agent: Agent, job: Job, now: number) {
  const rect = job.element.getBoundingClientRect();
  const start = { x: rect.left, y: rect.top };
  const end = { x: rect.right, y: rect.bottom };
  const time = now - agent.since;
  let position = start;
  let tool: Tool = 'crosshair';
  let pressed = false;

  switch (agent.phase) {
    case 'travel': {
      const duration = clamp(Math.hypot(start.x - agent.origin.x, start.y - agent.origin.y) * .58, 145, 340);
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
      if (time >= 90) activePhase(agent, 'draw', now);
      break;
    case 'draw': {
      const duration = job.kind === 'frame' ? clamp(270 + rect.width * .34, 330, 650)
        : job.kind === 'blocks' ? Math.max(250, job.parts.length * 22)
        : job.kind === 'rule' ? clamp(Math.max(rect.width, rect.height) * .52, 180, 490)
        : isText(job.kind) ? 205 : 190;
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
      } else if (job.kind === 'blocks') {
        const count = Math.floor(linear * job.parts.length);
        reveal(job, count);
        const current = job.parts[Math.min(count, job.parts.length - 1)];
        if (current) {
          const cell = current.getBoundingClientRect();
          position = { x: cell.left + cell.width / 2, y: cell.top + cell.height / 2 };
          selection(ctx, { x: cell.left, y: cell.top }, { x: cell.right, y: cell.bottom }, agent.color);
        }
      } else {
        const height = isText(job.kind) ? Math.min(45, rect.height) : rect.height;
        position.y = start.y + height * progress;
        selection(ctx, start, position, agent.color);
      }
      pressed = progress < .3;
      if (linear === 1) {
        if (isText(job.kind)) activePhase(agent, 'type', now);
        else {
          complete(job);
          activePhase(agent, 'release', now);
        }
      }
      break;
    }
    case 'type': {
      const step = job.kind === 'align' ? 61 : job.parts.length > 38 ? 22 : 36;
      reveal(job, Math.max(0, Math.floor((time - 85) / step)));
      const glyph = job.parts[Math.max(0, job.drawn - 1)]?.getBoundingClientRect();
      if (glyph) {
        position = { x: job.drawn ? glyph.right + 1 : glyph.left, y: glyph.top + glyph.height / 2 };
        const half = Math.min(38, glyph.height * .4);
        if (Math.floor(time / 155) % 4 !== 3) {
          trace(ctx, { x: position.x, y: position.y - half }, { x: position.x, y: position.y + half }, agent.color, 1.6);
        }
      }
      tool = 'caret';
      if (time >= 180 + job.parts.length * step) activePhase(agent, job.kind === 'align' ? 'align' : 'release', now);
      break;
    }
    case 'align': {
      const progress = clamp(time / 540);
      const actualX = rect.left - job.offset;
      const inset = Math.max(0, Math.min(12, innerWidth - rect.right + job.offset - 4));
      job.offset = progress < .25 ? inset * smooth(progress / .25) : inset * (1 - smooth((progress - .25) / .75));
      job.element.style.setProperty('--swarm-offset', job.offset + 'px');
      drawRuler(ctx, { x: actualX, y: rect.top }, agent.color);
      selection(ctx, { x: actualX + job.offset, y: rect.top }, { x: actualX + job.offset + rect.width, y: rect.bottom }, agent.color);
      position = { x: actualX + job.offset + 10, y: rect.top + 7 };
      tool = 'arrow';
      pressed = progress > .1 && progress < .9;
      if (progress === 1) activePhase(agent, 'release', now);
      break;
    }
    case 'release':
      position = { x: agent.x, y: agent.y };
      tool = isText(job.kind) ? 'caret' : 'arrow';
      if (time >= 100) {
        complete(job);
        agent.job = undefined;
      }
      break;
  }
  Object.assign(agent, position);
  drawPointer(ctx, agent, tool, pressed);
}

export function SwarmAssembly({ children, onReady, onReplay }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const replayRef = useRef<HTMLButtonElement>(null);
  const skipRef = useRef<HTMLButtonElement>(null);
  const callbacks = useRef({ onReady, onReplay });

  useEffect(() => {
    callbacks.current = { onReady, onReplay };
  }, [onReady, onReplay]);

  useLayoutEffect(() => {
    const root = rootRef.current, canvas = canvasRef.current, controls = controlsRef.current;
    const replay = replayRef.current, skip = skipRef.current;
    const ctx = canvas?.getContext('2d');
    if (!root || !canvas || !controls || !replay || !skip || !ctx) {
      const request = requestAnimationFrame(() => callbacks.current.onReady());
      return () => cancelAnimationFrame(request);
    }

    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    let jobs: Job[] = [], agents: Agent[] = [];
    let frame = 0, startTime = 0, width = 0, height = 0, density = 0;
    let running = false, ready = false;

    function notifyReady() {
      if (ready) return;
      ready = true;
      callbacks.current.onReady();
    }

    function finish() {
      cancelAnimationFrame(frame);
      frame = 0;
      running = false;
      for (const job of jobs) complete(job);
      root!.removeAttribute('data-swarm-running');
      ctx!.clearRect(0, 0, width, height);
      if (document.activeElement === skip) replay!.focus({ preventScroll: true });
      skip!.hidden = true;
      notifyReady();
    }

    function fitCanvas() {
      const w = canvas!.clientWidth, h = canvas!.clientHeight, dpr = Math.min(devicePixelRatio || 1, 2);
      if (width === w && height === h && density === dpr) return;
      width = w; height = h; density = dpr;
      canvas!.width = Math.round(width * dpr);
      canvas!.height = Math.round(height * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function tick(now: number) {
      frame = 0;
      if (!running) return;
      fitCanvas();
      ctx!.clearRect(0, 0, width, height);
      const intro = now - startTime < 720 && scrollY < 8;
      if (intro) {
        const progress = smooth(clamp((now - startTime) / 570));
        const center = { x: width / 2, y: height * .45 };
        badge(ctx!, 'CNSS / 2026', { x: center.x - 35, y: center.y - 8 }, '#a1adbf');
        for (const agent of agents) {
          const angle = agent.angle + (now - startTime) * .002;
          agent.x = mix(agent.origin.x, center.x + Math.cos(angle) * 78, progress);
          agent.y = mix(agent.origin.y, center.y + Math.sin(angle) * 44, progress);
          drawPointer(ctx!, agent, 'arrow');
        }
        frame = requestAnimationFrame(tick);
        return;
      }

      // A job above the viewport can be committed without replaying a missed
      // stroke. Jobs below the fold keep their state until the user reaches them.
      const waiting = jobs.filter(job => job.state === 'waiting');
      for (const job of waiting) {
        const rect = job.element.getBoundingClientRect();
        if (!job.element.getClientRects().length || rect.bottom < -24) complete(job);
      }
      const done = new Set(jobs.filter(job => job.state === 'done').map(job => job.id));
      const available = waiting.filter(job => job.state === 'waiting'
        && job.after.every(id => done.has(id))
        && job.element.getBoundingClientRect().top < height + 32);

      for (const agent of agents) {
        if (!agent.job) {
          const job = available.shift();
          if (job) {
            job.state = 'active';
            agent.job = job;
            agent.origin = { x: agent.x, y: agent.y };
            activePhase(agent, 'travel', now);
          }
        }
        const job = agent.job;
        if (job) perform(ctx!, agent, job, now);
      }

      if (jobs.every(job => job.state === 'done') && agents.every(agent => !agent.job)) {
        finish();
        return;
      }
      if (agents.some(agent => agent.job)) {
        frame = requestAnimationFrame(tick);
        return;
      }

      // Re-evaluate after the final agents release a dependency this frame.
      const finishedIds = new Set(jobs.filter(job => job.state === 'done').map(job => job.id));
      if (jobs.some(job => job.state === 'waiting'
        && job.after.every(id => finishedIds.has(id))
        && job.element.getBoundingClientRect().top < height + 32)) {
        frame = requestAnimationFrame(tick);
        return;
      }
      ctx!.clearRect(0, 0, width, height);
      notifyReady();
    }

    function start() {
      cancelAnimationFrame(frame);
      jobs.forEach(reset);
      jobs = collectJobs(root!);
      ready = false;
      controls!.hidden = motion.matches;
      if (motion.matches || !jobs.length) {
        frame = requestAnimationFrame(finish);
        return;
      }
      root!.setAttribute('data-swarm-running', '');
      skip!.hidden = false;
      fitCanvas();
      running = true;
      startTime = performance.now();
      const count = width < 640 ? 5 : TOOLS.length;
      agents = TOOLS.slice(0, count).map(([name, color], index) => {
        const angle = index / count * Math.PI * 2;
        const x = width * (.5 + Math.cos(angle) * .4);
        const y = height * (.45 + Math.sin(angle) * .31);
        return { name, color, x, y, origin: { x, y }, angle, since: startTime, phase: 'travel' };
      });
      frame = requestAnimationFrame(tick);
    }

    function wake() {
      if (running && !frame) frame = requestAnimationFrame(tick);
    }

    function replayAnimation() {
      callbacks.current.onReplay();
      window.scrollTo({ top: 0, behavior: 'instant' });
      start();
    }

    function respectMotionPreference() {
      controls!.hidden = motion.matches;
      if (motion.matches) finish();
    }

    function respectKeyboardFocus(event: FocusEvent) {
      if (running && event.target instanceof HTMLElement && !controls!.contains(event.target)
        && event.target.matches(':focus-visible')) finish();
    }

    start();
    replay.addEventListener('click', replayAnimation);
    skip.addEventListener('click', finish);
    window.addEventListener('scroll', wake, { passive: true });
    window.addEventListener('resize', wake);
    document.addEventListener('focusin', respectKeyboardFocus);
    motion.addEventListener('change', respectMotionPreference);
    return () => {
      cancelAnimationFrame(frame);
      root.removeAttribute('data-swarm-running');
      jobs.forEach(reset);
      replay.removeEventListener('click', replayAnimation);
      skip.removeEventListener('click', finish);
      window.removeEventListener('scroll', wake);
      window.removeEventListener('resize', wake);
      document.removeEventListener('focusin', respectKeyboardFocus);
      motion.removeEventListener('change', respectMotionPreference);
    };
  }, []);

  return (
    <div ref={rootRef} className={styles.assembly}>
      {children}
      <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
      <div ref={controlsRef} className={styles.controls} role="group" aria-label="构造动画" hidden>
        <button ref={replayRef} type="button">重新构造</button>
        <button ref={skipRef} type="button">跳过动画</button>
      </div>
    </div>
  );
}

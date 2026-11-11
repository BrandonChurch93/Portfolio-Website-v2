import { LAMP } from '../config/site';
import { clock } from '../world/clock';
import { approach, driftAt, type Point } from './drift';

export interface LampState {
  // Position as a fraction of the viewport, 0 to 1.
  x: number;
  y: number;
  // Position in CSS pixels of the viewport.
  px: number;
  py: number;
  // 1 while a real cursor leads it, 0 while it drifts.
  led: number;
}

type Listener = (s: LampState) => void;

// The one lamp. Its position is the cursor, eased. With no cursor it drifts slowly and leans toward the last touch.
class Lamp {
  private pos: Point = { x: LAMP.drift.cx, y: LAMP.drift.cy };
  private cursor: Point | null = null;
  private lastMove = -Infinity;
  private touch: Point | null = null;
  private touchAt = -Infinity;
  private forced: Point | null = null;
  private still = false;
  private led = 0;
  private listeners = new Set<Listener>();
  private bound = false;
  private state: LampState = { x: this.pos.x, y: this.pos.y, px: 0, py: 0, led: 0 };

  bind(): void {
    if (this.bound || typeof window === 'undefined') return;
    this.bound = true;
    this.still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const vw = () => Math.max(1, innerWidth);
    const vh = () => Math.max(1, innerHeight);
    addEventListener('pointermove', (e) => {
      const p = { x: e.clientX / vw(), y: e.clientY / vh() };
      if (e.pointerType === 'touch') return;
      this.cursor = p;
      this.lastMove = clock.now();
    }, { passive: true });
    addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'touch') return;
      this.touch = { x: e.clientX / vw(), y: e.clientY / vh() };
      this.touchAt = clock.now();
    }, { passive: true });
    document.documentElement.addEventListener('pointerleave', () => { this.lastMove = -Infinity; });
    clock.onFrame((t, dt) => this.update(t, dt));
  }

  // Test hook: hold the lamp at a point of the viewport, 0 to 1. null releases it.
  force(p: Point | null): void {
    this.forced = p;
    if (p) this.pos = { ...p };
    this.update(clock.now(), 0);
  }

  get(): LampState {
    return this.state;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.state);
    return () => this.listeners.delete(fn);
  }

  private goal(t: number): { p: Point; led: boolean } {
    if (this.forced) return { p: this.forced, led: true };
    const cursorLive = this.cursor && t - this.lastMove < LAMP.idleAfter;
    if (cursorLive && this.cursor) return { p: this.cursor, led: true };
    if (this.still) return { p: this.cursor ?? { x: LAMP.drift.cx, y: LAMP.drift.cy }, led: false };
    return { p: driftAt(t, this.touch, t - this.touchAt), led: false };
  }

  private update(t: number, dt: number): void {
    const { p, led } = this.goal(t);
    // A frozen clock snaps, so a frozen frame always shows the same lamp.
    if (this.forced || clock.isFrozen()) this.pos = { ...p };
    else {
      const rate = led ? LAMP.follow : LAMP.follow * 0.35;
      this.pos = { x: approach(this.pos.x, p.x, rate, dt), y: approach(this.pos.y, p.y, rate, dt) };
    }
    this.led = clock.isFrozen() ? (led ? 1 : 0) : approach(this.led, led ? 1 : 0, 3, dt);
    const w = typeof window === 'undefined' ? 1 : innerWidth;
    const h = typeof window === 'undefined' ? 1 : innerHeight;
    this.state = { x: this.pos.x, y: this.pos.y, px: this.pos.x * w, py: this.pos.y * h, led: this.led };
    for (const fn of this.listeners) fn(this.state);
  }
}

export const lamp = new Lamp();

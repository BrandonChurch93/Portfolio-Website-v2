import { gsap } from 'gsap';
import { CLOCK } from '../config/site';

export type FrameListener = (t: number, dt: number) => void;

// The one clock. Pieces, water, the lamp drift and GSAP all read time from here, and freeze(t) holds all of them.
// Time advances by real frame time, clamped, so a tab that was hidden does not jump ahead.
class Clock {
  private t = 0;
  private frozen: number | null = null;
  private lastReal = 0;
  private raf = 0;
  private started = false;
  private listeners = new Set<FrameListener>();
  // Where the page is scrolled and how big the window is, read once at the start of a frame, before anything writes:
  // read after a write, these make the browser recalculate styles there and then.
  readonly view = { x: 0, y: 0, w: 1, h: 1 };

  readView(): void {
    if (typeof window === 'undefined') return;
    this.view.x = scrollX;
    this.view.y = scrollY;
    this.view.w = innerWidth;
    this.view.h = innerHeight;
  }

  now(): number {
    return this.frozen ?? this.t;
  }

  isFrozen(): boolean {
    return this.frozen !== null;
  }

  freeze(t: number | null): void {
    if (t === null) {
      if (this.frozen !== null) this.t = this.frozen;
      this.frozen = null;
      this.lastReal = performance.now();
    } else {
      this.frozen = t;
    }
    this.emit(0);
  }

  onFrame(fn: FrameListener): () => void {
    this.listeners.add(fn);
    this.start();
    return () => this.listeners.delete(fn);
  }

  start(): void {
    if (this.started || typeof window === 'undefined') return;
    this.started = true;
    gsap.ticker.remove(gsap.updateRoot);
    gsap.ticker.lagSmoothing(0);
    this.lastReal = performance.now();
    const loop = (real: number) => {
      const step = Math.min(CLOCK.maxStep, Math.max(0, (real - this.lastReal) / 1000));
      this.lastReal = real;
      let dt = 0;
      if (this.frozen === null) {
        this.t += step;
        dt = step;
      }
      this.emit(dt);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  // Runs every listener once now, for a frozen frame that must be drawn before the next animation frame.
  emit(dt: number): void {
    this.readView();
    const t = this.now();
    gsap.updateRoot(t);
    for (const fn of this.listeners) fn(t, dt);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
    this.started = false;
  }
}

export const clock = new Clock();

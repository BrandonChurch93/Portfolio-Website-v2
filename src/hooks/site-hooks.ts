import { HOOK_PARAM, SETTLE, TIERS, type Tier } from '../config/site';
import { lamp } from '../lamp/lamp';
import { clock } from '../world/clock';
import { tiers } from '../world/tier';
import { registry, stats, type PieceHandle } from './registry';

export interface SiteHooks {
  settle(): Promise<true>;
  freeze(t: number | null): void;
  lamp(x: number, y: number): void;
  scrollTo(idOrY: string | number): Promise<true>;
  tier(name: Tier | null): void;
  opening(t: number): void;
  water: { head(v: number | string): void; move(name: string, t: number): void };
  piece(name: string): PieceHandle;
  info(): { tier: Tier; frozen: boolean; time: number; scrollY: number; probeMs: number | null; lamp: { x: number; y: number }; stats: Record<string, number> };
}

declare global {
  interface Window {
    __site?: SiteHooks;
  }
}

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

const within = <T,>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<void>((r) => setTimeout(r, ms))]);

// Waits for eager pictures and for pictures on screen now. A lazy picture off screen may never start loading,
// so it is not waited for; each wait is also capped, so settle() can never hang on one picture.
async function picturesLoaded(): Promise<void> {
  const onScreen = (im: HTMLImageElement) => { const r = im.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight && r.width > 0; };
  const imgs = [...document.images].filter((im) => im.loading !== 'lazy' || onScreen(im));
  const ready = (im: HTMLImageElement) => (im.complete
    ? im.decode().catch(() => undefined)
    : new Promise<void>((r) => { im.addEventListener('load', () => r(), { once: true }); im.addEventListener('error', () => r(), { once: true }); }));
  await Promise.all(imgs.map((im) => within(ready(im), SETTLE.pictureMs)));
}

async function settle(): Promise<true> {
  const until = performance.now() + SETTLE.timeoutMs;
  await document.fonts.ready;
  do {
    await picturesLoaded();
    await registry.idle();
    for (let i = 0; i < SETTLE.frames; i++) await frame();
  } while (performance.now() < until && (document.readyState !== 'complete'));
  await registry.idle();
  clock.emit(0);
  await frame();
  return true;
}

export function hooksWanted(): boolean {
  return typeof window !== 'undefined' && new URLSearchParams(location.search).get(HOOK_PARAM) === '1';
}

// Exposes window.__site only with ?hook=1. The harness and the tests drive the site through nothing else.
export function installHooks(): void {
  if (!hooksWanted() || window.__site) return;
  document.documentElement.dataset.hook = '1';
  window.__site = {
    settle,
    freeze(t) {
      clock.freeze(t);
      registry.freezeAll(t);
    },
    lamp(x, y) {
      lamp.force({ x, y });
    },
    // Settles first, so late layout cannot move the target after the jump; lands on a whole pixel; checks once more.
    async scrollTo(idOrY) {
      await settle();
      const target = () => {
        if (typeof idOrY === 'number') return Math.round(idOrY);
        const el = document.getElementById(idOrY);
        if (!el) throw new Error(`scrollTo: no element with id ${idOrY}`);
        return Math.round(el.getBoundingClientRect().top + scrollY);
      };
      for (let i = 0; i < 3; i++) {
        const y = target();
        if (Math.abs(scrollY - y) < 0.5 && i > 0) break;
        window.scrollTo({ top: y, left: 0, behavior: 'instant' });
        dispatchEvent(new Event('scroll'));
        await settle();
      }
      return true;
    },
    tier(name) {
      if (name !== null && !TIERS.includes(name)) throw new Error(`tier: ${name} is not one of ${TIERS.join(', ')}`);
      tiers.force(name);
    },
    opening(t) {
      const fn = registry.getOpening();
      if (fn) fn(t);
    },
    water: {
      head(v) {
        const w = registry.getWater();
        if (!w) throw new Error('water.head: no water on this page');
        w.head(v);
      },
      move(name, t) {
        const w = registry.getWater();
        if (!w) throw new Error('water.move: no water on this page');
        w.move(name, t);
      },
    },
    piece(name) {
      const p = registry.getPiece(name);
      if (!p) throw new Error(`piece: ${name} is not mounted on this page`);
      return p;
    },
    info() {
      const l = lamp.get();
      return { tier: tiers.get(), frozen: clock.isFrozen(), time: clock.now(), scrollY, probeMs: tiers.probeMs, lamp: { x: l.x, y: l.y }, stats: { ...stats } };
    },
  };
}

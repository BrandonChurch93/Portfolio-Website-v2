import { LAMP } from '../config/site';

export interface Point {
  x: number;
  y: number;
}

// Where the lamp drifts on its own at time t, as a fraction of the viewport, leaning toward the last touch.
// Pure, so it can be tested and so a frozen clock always gives the same lamp.
export function driftAt(t: number, touch: Point | null, touchAge: number): Point {
  const d = LAMP.drift;
  const base = {
    x: d.cx + d.ax * Math.sin(t * d.fx * Math.PI * 2),
    y: d.cy + d.ay * Math.cos(t * d.fy * Math.PI * 2 + 0.7),
  };
  if (!touch) return base;
  const k = d.touchLean * Math.max(0, 1 - touchAge / d.touchHold);
  return { x: base.x + (touch.x - base.x) * k, y: base.y + (touch.y - base.y) * k };
}

// Exponential approach that does not depend on frame rate.
export function approach(from: number, to: number, rate: number, dt: number): number {
  return to + (from - to) * Math.exp(-rate * dt);
}

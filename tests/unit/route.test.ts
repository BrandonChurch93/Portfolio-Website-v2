import { describe, expect, it } from 'vitest';
import { buildRoute, crossings, headAt, headTable, KIND_ID, maxKink, sAtFlowTime, type Anchor, type Rect, type RouteOptions } from '../../src/water/route';

const rect = (left: number, top: number, w: number, h: number): Rect => ({ left, top, right: left + w, bottom: top + h });

// A home page in miniature: work plates, the client bar framing placards, a desk edge, a portrait, a pool.
function desktop() {
  const text: Rect[] = [rect(160, 1000, 640, 120), rect(160, 1200, 760, 470), rect(680, 1800, 760, 470), rect(200, 2600, 1040, 300), rect(200, 4400, 600, 300)];
  const anchors: Anchor[] = [
    { id: 'p1', kind: 'weave', side: 'right', rect: text[1] },
    { id: 'p2', kind: 'weave', side: 'left', rect: text[2] },
    { id: 'bar', kind: 'split', rect: rect(160, 2500, 1120, 56), frame: text[3] },
    { id: 'desk', kind: 'edge', rect: rect(160, 3200, 1120, 560), from: { x: 260, y: 3600 }, to: { x: 1180, y: 3700 } },
    { id: 'portrait', kind: 'weave', side: 'right', rect: text[4] },
    { id: 'pad', kind: 'pool', rect: rect(420, 5200, 600, 300) },
  ];
  const o: RouteOptions = { start: { x: 720, y: 760 }, column: { left: 160, right: 1280 }, narrow: false, width: 1440, avoid: text, endY: 5600 };
  return { text, anchors, o };
}

function phone() {
  const text: Rect[] = [rect(20, 900, 350, 200), rect(20, 1200, 350, 520), rect(20, 1820, 350, 520), rect(30, 2500, 330, 800)];
  const anchors: Anchor[] = [
    { id: 'p1', kind: 'weave', side: 'right', rect: text[1] },
    { id: 'p2', kind: 'weave', side: 'left', rect: text[2] },
    { id: 'bar', kind: 'split', rect: rect(20, 2420, 350, 48), frame: text[3] },
    { id: 'pad', kind: 'pool', rect: rect(40, 3600, 310, 220) },
  ];
  const o: RouteOptions = { start: { x: 195, y: 700 }, column: { left: 20, right: 370 }, narrow: true, width: 390, avoid: text, endY: 4000 };
  return { text, anchors, o };
}

for (const [name, make] of [['desktop', desktop], ['phone', phone]] as const) {
  describe(`route builder · ${name}`, () => {
    const { text, anchors, o } = make();
    const route = buildRoute(anchors, o);

    it('never crosses text', () => {
      expect(crossings(route, text)).toEqual([]);
    });

    it('stays on the page', () => {
      for (const b of route.branches) for (const p of b.samples) {
        expect(p.x - p.hw).toBeGreaterThanOrEqual(0);
        expect(p.x + p.hw).toBeLessThanOrEqual(name === 'phone' ? 390 : 1440);
      }
    });

    it('has distance and travel time rising along every branch', () => {
      for (const b of route.branches) for (let i = 1; i < b.samples.length; i++) {
        expect(b.samples[i].s).toBeGreaterThan(b.samples[i - 1].s);
        expect(b.samples[i].f).toBeGreaterThanOrEqual(b.samples[i - 1].f);
      }
    });

    it('splits into two halves that share their start and rejoin at the same distance', () => {
      const split = route.landings.find((l) => l.dir === 0)!;
      expect(split).toBeDefined();
      const halves = route.branches.filter((b) => Math.abs(b.samples[0].s - split.s) < 1e-6);
      expect(halves.length).toBe(2);
      const after = route.branches.find((b) => b.samples[0].s > split.s && !halves.includes(b))!;
      const ends = halves.map((b) => b.samples[b.samples.length - 1].s);
      expect(after.samples[0].s).toBeCloseTo(Math.max(...ends), 6);
      // The halves are near mirror images, so neither waits long for the other.
      expect(Math.abs(ends[0] - ends[1])).toBeLessThan(40);
    });

    it('speeds up as it falls, and thins', () => {
      for (const b of route.branches) {
        const falls = b.samples.map((p, i) => ({ p, i })).filter(({ p }) => p.kind === KIND_ID.fall);
        for (let k = 3; k < falls.length; k++) {
          const a = b.samples[falls[k - 1].i], c = b.samples[falls[k].i];
          if (falls[k].i !== falls[k - 1].i + 1 || c.drop < a.drop) continue;
          const prev = b.samples[falls[k - 2].i];
          const v1 = (a.s - prev.s) / Math.max(1e-9, a.f - prev.f);
          const v2 = (c.s - a.s) / Math.max(1e-9, c.f - a.f);
          expect(v2).toBeGreaterThanOrEqual(v1 * 0.98);
          expect(c.hw).toBeLessThanOrEqual(a.hw + 1e-9);
        }
      }
    });

    it('has no kink between samples', () => {
      expect(maxKink(route)).toBeLessThan(0.45);
    });

    it('lands on the bar and on the desk, and ends in the pool', () => {
      expect(route.landings.map((l) => l.anchor)).toContain('bar');
      if (name === 'desktop') expect(route.landings.map((l) => l.anchor)).toContain('desk');
      expect(route.pools.length).toBe(1);
      expect(route.pools[0].s).toBeCloseTo(route.total, 6);
    });

    it('lets the head follow the page down and back up', () => {
      const t = headTable(route);
      let last = -1;
      for (let y = o.start.y; y < o.endY; y += 37) {
        const s = headAt(t, y);
        expect(s).toBeGreaterThanOrEqual(last);
        last = s;
      }
      expect(headAt(t, o.start.y - 100)).toBe(0);
      expect(headAt(t, 1e9)).toBeCloseTo(route.total, 6);
    });

    it('finds the front from travel time, faster through falls', () => {
      expect(sAtFlowTime(route, 0)).toBe(0);
      let last = 0;
      for (let f = 0.1; f < 20; f += 0.1) {
        const s = sAtFlowTime(route, f);
        expect(s).toBeGreaterThanOrEqual(last);
        last = s;
      }
    });
  });
}

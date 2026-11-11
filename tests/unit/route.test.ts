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
      if (name === 'desktop') {
        expect(after.samples[0].s).toBeCloseTo(Math.max(...ends), 6);
        // The halves are near mirror images, so neither waits long for the other.
        expect(Math.abs(ends[0] - ends[1])).toBeLessThan(40);
      } else {
        // On the phone the stream goes on from the half that arrives first; the other joins it as a tributary.
        expect(after.samples[0].s).toBeCloseTo(Math.min(...ends), 6);
        expect(Math.abs(after.samples[0].x - halves[0].samples.at(-1)!.x)).toBeLessThan(2);
      }
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

describe('route builder · handed to a piece', () => {
  for (const [name, make, at] of [['desktop', desktop, { x: 160, y: 5420 }], ['phone', phone, { x: 20, y: 3760 }]] as const) {
    const { text, anchors, o } = make();
    const handed = anchors.map((a) => (a.kind === 'pool' ? { ...a, rect: { ...a.rect, left: at.x }, at } : a));
    const route = buildRoute(handed, o);
    const end = route.branches[route.branches.length - 1].samples.at(-1)!;

    it(`${name}: ends level at the piece's edge and draws no pool of its own`, () => {
      expect(route.pools.length).toBe(0);
      expect(Math.abs(end.y - at.y)).toBeLessThan(2);
      expect(end.x).toBeGreaterThan(at.x);
      expect(end.x).toBeLessThan(at.x + 10);
      expect(route.touch.map((t) => t.anchor)).toContain('pad');
    });

    it(`${name}: still crosses no text and has no kink`, () => {
      expect(crossings(route, text)).toEqual([]);
      expect(maxKink(route)).toBeLessThan(0.45);
    });
  }
});

describe('route builder · a long run with nothing to meet', () => {
  for (const narrow of [false, true]) {
    const o: RouteOptions = { start: { x: 1372, y: 0 }, column: { left: 160, right: 1280 }, narrow, width: 1440, avoid: [], endY: 3200 };
    const route = buildRoute([], o);
    const xs = route.branches.flatMap((b) => b.samples.map((p) => p.x));
    const off = Math.max(...xs.map((x) => Math.abs(x - o.start.x)));

    it(`${narrow ? 'phone' : 'desktop'}: ${narrow ? 'runs straight in the narrow margin' : 'meanders a little, never straight down the gutter'}`, () => {
      if (narrow) expect(off).toBeLessThan(1);
      else { expect(off).toBeGreaterThan(6); expect(off).toBeLessThanOrEqual(12.5); }
    });

    it(`${narrow ? 'phone' : 'desktop'}: has no kink and keeps rising along the way`, () => {
      expect(maxKink(route)).toBeLessThan(0.45);
      for (const b of route.branches) for (let i = 1; i < b.samples.length; i++) expect(b.samples[i].s).toBeGreaterThan(b.samples[i - 1].s);
    });
  }
});

describe('route builder · text right under the desk', () => {
  const { text, anchors, o } = desktop();
  // The skills ledger starts just below the desk, across the whole column.
  const ledger = rect(160, 3790, 1120, 520);
  const all = [...text, ledger];
  const route = buildRoute(anchors, { ...o, avoid: all });
  it('pours off the desk and goes round the ledger without crossing it', () => {
    expect(crossings(route, all)).toEqual([]);
    expect(maxKink(route)).toBeLessThan(0.45);
  });
});

describe('route builder · the end of a page with text below the last anchor', () => {
  const desk = rect(160, 900, 640, 300);
  const ledger = rect(160, 1230, 640, 900);
  const footer = rect(160, 2300, 640, 120);
  const anchors: Anchor[] = [{ id: 'desk', kind: 'edge', rect: desk, from: { x: 200, y: 1080 }, to: { x: 750, y: 1110 } }];
  const o: RouteOptions = { start: { x: 790, y: 0 }, column: { left: 160, right: 800 }, narrow: false, width: 834, avoid: [ledger, footer], endY: 2480 };
  const route = buildRoute(anchors, o);
  it('goes round the ledger and the footer on its way to the foot of the page', () => {
    expect(crossings(route, [ledger, footer])).toEqual([]);
    expect(maxKink(route)).toBeLessThan(0.45);
  });
});

// The home page's work wall: the city's water falls onto a lintel set in from the cards, pours onto the top corners of
// the outer cards, clings down both sides and meets behind the link under the wall.
describe('route builder · the work wall', () => {
  for (const narrow of [false, true]) {
    const W = narrow ? 390 : 1440, left = narrow ? 22 : 160, right = W - left, inset = narrow ? 16 : 40;
    const grid = rect(left, 1190, right - left, narrow ? 1600 : 900);
    const bar = rect(left + inset, 1010, right - left - inset * 2, 56);
    const more = rect(W / 2 - 110, grid.bottom + 60, 220, 48);
    const head = rect(W / 2 - 150, more.bottom + 190, 300, 110);
    const deskTop = head.bottom + 60;
    const anchors: Anchor[] = [
      { id: 'work', kind: 'split', rect: bar, frame: grid, join: more },
      { id: 'desk', kind: 'edge', rect: rect(left, deskTop, right - left, 500), from: { x: left + 70, y: deskTop + 320 }, to: { x: right - 70, y: deskTop + 380 } },
    ];
    const o: RouteOptions = { start: { x: W / 2, y: 830 }, column: { left, right }, narrow, width: W, avoid: [head], endY: deskTop + 1200 };
    const route = buildRoute(anchors, o);
    const name = narrow ? 'phone' : 'desktop';
    const split = route.landings.find((l) => l.anchor === 'work')!;
    const halves = route.branches.filter((b) => Math.abs(b.samples[0].s - split.s) < 1e-6);
    const inJoin = (p: { x: number; y: number }) => p.x > more.left && p.x < more.right && p.y > more.top && p.y < more.bottom;

    it(`${name}: reaches the middle of the lintel in one fall`, () => {
      expect(split.dir).toBe(0);
      expect(Math.abs(split.x - W / 2)).toBeLessThan(1);
      const first = route.branches[0].samples;
      expect(first.every((p) => p.kind === KIND_ID.fall)).toBe(true);
      expect(first.at(-1)!.y).toBeCloseTo(split.y, 3);
    });

    it(`${name}: pours onto the top corner of each outer card`, () => {
      for (const [id, corner, dir] of [['work:landL', grid.left, -1], ['work:landR', grid.right, 1]] as const) {
        const l = route.landings.find((x) => x.anchor === id)!;
        expect(l, id).toBeDefined();
        expect(l.dir).toBe(dir);
        expect(l.y).toBeLessThan(grid.top);
        expect(l.y).toBeGreaterThan(grid.top - 4);
        const inFromCorner = dir * (corner - l.x);
        expect(inFromCorner).toBeGreaterThanOrEqual(8 - 1e-6);
        expect(inFromCorner).toBeLessThanOrEqual(34 + 1e-6);
      }
    });

    it(`${name}: clings down both sides just outside the cards and never runs across them`, () => {
      const clings = route.branches.flatMap((b) => b.samples).filter((p) => p.kind === KIND_ID.cling && p.y > grid.top + 20 && p.y < grid.bottom);
      expect(clings.some((p) => p.x < grid.left && p.x > grid.left - 8)).toBe(true);
      expect(clings.some((p) => p.x > grid.right && p.x < grid.right + 8)).toBe(true);
      expect(crossings(route, [rect(grid.left + 12, grid.top + 12, grid.right - grid.left - 24, grid.bottom - grid.top - 24)], 0)).toEqual([]);
    });

    it(`${name}: the two sides share their distances, meet behind the link, and one stream goes on from there`, () => {
      // Four strands leave the middle: each side's run and pour, then its cling and turn in after the landing.
      const lands = route.landings.filter((l) => l.anchor.startsWith('work:land'));
      expect(halves.length).toBe(2);
      expect(Math.abs(lands[0].s - lands[1].s)).toBeLessThan(1e-6);
      const sides = route.branches.filter((b) => Math.abs(b.samples[0].s - lands[0].s) < 1e-6);
      expect(sides.length).toBe(2);
      const ends = sides.map((b) => b.samples.at(-1)!);
      for (const e of ends) expect(inJoin(e)).toBe(true);
      expect(Math.abs(ends[0].s - ends[1].s)).toBeLessThan(1e-6);
      const after = route.branches.find((b) => Math.abs(b.samples[0].s - ends[0].s) < 1e-6 && !sides.includes(b))!;
      expect(after).toBeDefined();
      expect(inJoin(after.samples[0])).toBe(true);
    });

    it(`${name}: goes on to the desk, crosses no text, and has no kink`, () => {
      expect(route.landings.map((l) => l.anchor)).toContain('desk');
      expect(crossings(route, [head])).toEqual([]);
      expect(maxKink(route)).toBeLessThan(0.45);
      for (const b of route.branches) for (let i = 1; i < b.samples.length; i++) expect(b.samples[i].s).toBeGreaterThan(b.samples[i - 1].s);
    });
  }
});

describe('route builder · behind the portrait', () => {
  const words = rect(160, 1400, 520, 420);
  const portrait = rect(760, 1300, 520, 650);
  const anchors: Anchor[] = [{ id: 'portrait', kind: 'behind', rect: portrait, at: { x: 1020, y: 1703 } }];
  const o: RouteOptions = { start: { x: 1330, y: 700 }, column: { left: 160, right: 1280 }, narrow: false, width: 1440, avoid: [words], endY: 2600 };
  const route = buildRoute(anchors, o);
  const all = route.branches.flatMap((b) => b.samples);

  it('comes in at the top corner on its own side and sweeps through the point behind him at an angle', () => {
    const t = route.touch.find((x) => x.anchor === 'portrait')!;
    expect(t).toBeDefined();
    expect(Math.abs(t.x - 1020)).toBeLessThan(1);
    const inTop = all.filter((p) => p.y > portrait.top && p.y < portrait.top + 80);
    expect(inTop.length).toBeGreaterThan(0);
    for (const p of inTop) expect(p.x).toBeGreaterThan(1020 + 120);
    // Through the point it is still moving sideways as well as down: it does not drop straight through his head.
    const at = all.findIndex((p) => Math.abs(p.s - t.s) < 1e-6);
    const before = all[at - 6], after = all[at + 6];
    expect(Math.abs(after.x - before.x)).toBeGreaterThan(Math.abs(after.y - before.y) * 0.6);
  });

  it('leaves under the far lower corner, crosses no text, and has no kink', () => {
    const below = all.filter((p) => p.y > portrait.bottom && p.y < portrait.bottom + 30);
    expect(below.some((p) => p.x < 1020 - 120)).toBe(true);
    expect(crossings(route, [words])).toEqual([]);
    expect(maxKink(route)).toBeLessThan(0.45);
  });
});

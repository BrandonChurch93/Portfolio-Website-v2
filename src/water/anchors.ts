import type { Anchor, AnchorKind, Rect, RouteOptions } from './route';

// Reads the water's anchors from the page. Sections mark where the water may touch them:
//   data-water="weave|corner|split|edge|pool"  data-water-side="left|right"
//   data-water-frame="#id" (split)  data-water-from="0.08,0.76" data-water-to="0.89,0.98" (edge, fractions of the box)
//   data-water-start (the source: bottom center, or data-water-x as a fraction of its width)
//   data-water-avoid (blocks of text it must not cross)  data-water-column (the page column it weaves around)

const pageRect = (el: Element): Rect => {
  const r = el.getBoundingClientRect();
  return { left: r.left + scrollX, top: r.top + scrollY, right: r.right + scrollX, bottom: r.bottom + scrollY };
};

const frac = (v: string | null): [number, number] | null => {
  if (!v) return null;
  const [a, b] = v.split(',').map(Number);
  return Number.isFinite(a) && Number.isFinite(b) ? [a, b] : null;
};

export function readAnchors(root: ParentNode, narrowBelow: number): { anchors: Anchor[]; options: RouteOptions } {
  const anchors: Anchor[] = [];
  root.querySelectorAll<HTMLElement>('[data-water]').forEach((el, i) => {
    if (!el.offsetParent && el.getClientRects().length === 0) return;
    const kind = el.dataset.water as AnchorKind;
    const rect = pageRect(el);
    const a: Anchor = { id: el.id || el.dataset.waterId || `a${i}`, kind, rect };
    if (el.dataset.waterFall) a.fall = Number(el.dataset.waterFall);
    if (el.dataset.waterSide === 'left' || el.dataset.waterSide === 'right') a.side = el.dataset.waterSide;
    if (kind === 'split' && el.dataset.waterFrame) {
      const f = document.querySelector(el.dataset.waterFrame);
      if (f) a.frame = pageRect(f);
    }
    if (kind === 'edge') {
      const from = frac(el.dataset.waterFrom ?? null), to = frac(el.dataset.waterTo ?? null);
      if (from && to) {
        a.from = { x: rect.left + (rect.right - rect.left) * from[0], y: rect.top + (rect.bottom - rect.top) * from[1] };
        a.to = { x: rect.left + (rect.right - rect.left) * to[0], y: rect.top + (rect.bottom - rect.top) * to[1] };
      }
    }
    anchors.push(a);
  });
  const width = document.documentElement.clientWidth;
  const narrow = width < narrowBelow;
  const colEl = root.querySelector('[data-water-column]');
  const col = colEl ? pageRect(colEl) : { left: width * 0.08, right: width * 0.92, top: 0, bottom: 0 };
  const startEl = root.querySelector<HTMLElement>('[data-water-start]');
  // No source on this page: the stream enters from the top, in the right hand gutter, never down the middle.
  let start = { x: narrow ? (col.right + width) / 2 : Math.min(width - 24, col.right + 44), y: 0 };
  if (startEl) {
    const r = pageRect(startEl);
    const fx = Number(startEl.dataset.waterX ?? 0.5);
    start = { x: r.left + (r.right - r.left) * fx, y: startEl.dataset.waterY === 'top' ? r.top : r.bottom };
  }

  const avoid: Rect[] = [];
  root.querySelectorAll('[data-water-avoid]').forEach((el) => avoid.push(pageRect(el)));
  const endY = document.documentElement.scrollHeight - 40;
  return { anchors, options: { start, column: { left: col.left, right: col.right }, narrow, width, avoid, endY } };
}

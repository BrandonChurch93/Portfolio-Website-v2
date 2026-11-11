// Every named shot, in one table. It grows as shots are defined. scripts/shot-rules.mjs holds the required names.
//
// name -> {
//   route: '/lab/metal'          page to open, with ?hook=1 added (site shots)
//   ref: 'third-pass/index.html' a page under kit/reference/ that sets window.__ready (ref shots)
//   vp: 'desktop'                one of phone, tablet, desktop, wide, 4k (kit/07-QUALITY-BAR.md)
//   steps: [[hook, ...args]]     run in order through window.__site, then settle()
//   strip: { times, frame, cols, tileWidth }   a filmstrip, taken by scripts/strips.mjs
//   clip, fullPage, out          optional capture options
// }
// To see what is still missing, run: npm run check:shots
import { VPS } from './shot-rules.mjs';

const SHOTS = {};

// ---- ref: the reference pages, served from kit/reference/ ------------------------------------------
SHOTS['ref/second-pass-desktop'] = { ref: 'cards-and-water/second-pass.html', vp: 'desktop' };
SHOTS['ref/second-pass-phone'] = { ref: 'cards-and-water/second-pass.html', vp: 'phone' };
SHOTS['ref/third-pass-desktop'] = { ref: 'third-pass/index.html', vp: 'desktop' };
SHOTS['ref/third-pass-phone'] = { ref: 'third-pass/index.html', vp: 'phone' };

// ---- metal: /lab/metal, one specimen per screen ---------------------------------------------------
// Lamp positions as fractions of the viewport: upper left over the plate, right of center, low and left below it.
const LAMPS = [[0.36, 0.3], [0.66, 0.52], [0.3, 0.84]];
const metal = (id, lampXY, extra = {}) => ({
  route: '/lab/metal/', vp: 'desktop', target: `#${id} [data-finish]`, pad: 56,
  steps: [['scrollTo', id], ['freeze', 2], ['lamp', ...lampXY]], ...extra,
});
for (const f of ['aged', 'polished', 'bronze', 'panel']) {
  const name = f === 'polished' ? 'polished' : f;
  LAMPS.forEach((l, i) => { SHOTS[`metal/${name}-lamp-${i + 1}`] = metal(f, l); });
}
LAMPS.forEach((l, i) => { SHOTS[`metal/window-lamp-${i + 1}`] = metal('window', l); });
SHOTS['metal/text-1x'] = { ...metal('text', [0.42, 0.34]), target: '#text > div', scale: 1 };
SHOTS['metal/text-2x'] = { ...metal('text', [0.42, 0.34]), target: '#text > div', scale: 2 };
SHOTS['metal/window-video'] = metal('video', [0.4, 0.32], { steps: [['scrollTo', 'video'], ['freeze', 3.5], ['lamp', 0.4, 0.32]] });
SHOTS['metal/bar'] = metal('bar', [0.45, 0.4]);
SHOTS['metal/placard'] = { ...metal('placard', [0.4, 0.36]), target: '#placard > div' };
SHOTS['metal/controls'] = { ...metal('controls', [0.46, 0.4]), target: '#controls > div' };
SHOTS['metal/phone'] = { route: '/lab/metal/', vp: 'phone', steps: [['scrollTo', 'window'], ['freeze', 2], ['lamp', 0.6, 0.35]] };
SHOTS['metal/lamp-strip'] = {
  ...metal('polished', [0.15, 0.45]),
  strip: { times: [0.3, 0.357, 0.414, 0.471, 0.529, 0.586, 0.643, 0.7], frame: [['lamp', '$t', 0.42]], cols: 4, caption: (t) => `lamp at ${Math.round(t * 100)}% across` },
};

void VPS;

export { SHOTS };

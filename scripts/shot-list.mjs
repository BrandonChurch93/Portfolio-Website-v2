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

// ---- water: /lab/water, every move alone ------------------------------------------------------------
const steps8 = (a, b) => Array.from({ length: 8 }, (_, i) => Math.round((a + ((b - a) * i) / 7) * 1000) / 1000);
const waterMove = (name, a, b, extra = {}) => ({
  route: '/lab/water/', vp: 'desktop', steps: [['water.move', name, a]],
  strip: { times: steps8(a, b), frame: [['water.move', name, '$t']], cols: 4 }, ...extra,
});
SHOTS['water/body'] = { route: '/lab/water/', vp: 'desktop', steps: [['scrollTo', 'move-body'], ['freeze', 3], ['water.head', 1]] };
SHOTS['water/run'] = waterMove('run', 0, 1.75);
SHOTS['water/fall'] = waterMove('fall', 0, 0.63);
SHOTS['water/land'] = waterMove('land', 0.3, 1.5, { target: '#move-land [data-water]', pad: 150 });
SHOTS['water/cling'] = waterMove('cling', 0, 1.4, { target: '#move-cling [data-water]', pad: 110 });
SHOTS['water/pour'] = waterMove('pour', 0, 1.05, { target: '#move-pour [data-water]', pad: 160 });
SHOTS['water/split'] = waterMove('split', 0.3, 2.4);
SHOTS['water/frame'] = waterMove('frame', 0, 3.2);
SHOTS['water/pool'] = waterMove('pool', 0, 2.8, { target: '#move-pool [data-water]', pad: 120 });
SHOTS['water/light-plate'] = { route: '/lab/water/', vp: 'desktop', steps: [['scrollTo', 'move-light'], ['freeze', 3], ['water.head', 1], ['lamp', 0.08, 0.95]] };

// ---- city: /lab/piece/city, the piece alone at rest -------------------------------------------------
// aim takes millimetres of the city (park level y 0; plaza 31, middle terrace 19); view takes degrees and metres.
const city = (steps, extra = {}) => ({ route: '/lab/piece/city/', vp: 'desktop', steps: [['freeze', 10], ['lamp', 0.6, 0.3], ...steps], ...extra });
const close = (aim, view, lamp = [0.55, 0.35]) => city([['lamp', ...lamp], ['piece:city.aim', ...aim], ['piece:city.view', ...view]]);
SHOTS['city/form'] = city([['piece:city.clay', true], ['piece:city.view', -25, 22, 2.3]]);
SHOTS['city/close-1'] = close([0, 625, 0], [15, 6, 0.58]);
SHOTS['city/close-2'] = close([131, 199, 156], [44, 4, 0.24]);
SHOTS['city/close-3'] = close([0, 12, 250], [20, 30, 0.3]);
SHOTS['city/close-4'] = close([200, 0, 275], [30, 28, 0.28]);
SHOTS['city/close-5'] = close([40, -110, 480], [28, 6, 0.62], [0.5, 0.6]);
SHOTS['city/close-6'] = close([-40, 40, 100], [-15, 18, 0.3]);
SHOTS['city/materials'] = close([0, 210, 0], [40, 18, 2.25]);
SHOTS['city/light'] = city([['lamp', 0.3, 0.35]]);
SHOTS['city/light-2'] = city([['lamp', 0.75, 0.62]]);
SHOTS['city/making'] = city([['piece:city.setMaking', true]]);
for (const v of VPS) SHOTS[`city/rest-${v}`] = city([], { vp: v });
const steps12 = (a, b) => Array.from({ length: 12 }, (_, i) => Math.round((a + ((b - a) * i) / 11) * 100) / 100);
const opening = (vp, a, b) => city([['opening', a]], { vp, strip: { times: vp === 'desktop' && b - a < 4 ? steps8(a, b) : steps12(a, b), frame: [['opening', '$t']], cols: 4, caption: (t) => `${t.toFixed(2)} s` } });
SHOTS['city/opening-desktop'] = opening('desktop', 0, 7.4);
SHOTS['city/opening-phone'] = opening('phone', 0, 7.4);
SHOTS['city/settle'] = opening('desktop', 5.0, 7.6);

// ---- home: the page itself ------------------------------------------------------------------------
for (const v of VPS) SHOTS['home/hero-' + v] = { route: '/', vp: v, steps: [['freeze', 30], ['lamp', 0.62, 0.3]] };

// ---- tier: the hero and a room at the lower tiers ----------------------------------------------------
for (const tr of ['mid', 'low', 'static']) SHOTS['tier/hero-' + tr] = { route: '/', vp: 'desktop', tier: tr, steps: [['freeze', 30], ['lamp', 0.62, 0.3]] };

export { SHOTS };

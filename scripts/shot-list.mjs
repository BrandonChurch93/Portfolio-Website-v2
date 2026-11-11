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

// ---- bench: /lab/piece/workbench, the piece alone at rest -------------------------------------------
// aim takes millimetres of the bench (desk top y 0, front edge z 340); view takes degrees and metres.
const bench = (steps, extra = {}) => ({ route: '/lab/piece/workbench/', vp: 'desktop', steps: [['freeze', 10], ['lamp', 0.6, 0.3], ...steps], ...extra });
const bclose = (aim, view, lamp = [0.55, 0.35]) => bench([['lamp', ...lamp], ['piece:workbench.aim', ...aim], ['piece:workbench.view', ...view]]);
SHOTS['bench/form'] = bench([['piece:workbench.clay', true], ['piece:workbench.view', 28, 24, 2.75]]);
SHOTS['bench/close-1'] = bclose([110, 28, 130], [8, 38, 0.3]);
SHOTS['bench/close-2'] = bclose([40, 330, -215], [18, 6, 0.8]);
SHOTS['bench/close-3'] = bclose([492, 50, 96], [-25, 18, 0.34]);
SHOTS['bench/close-4'] = bclose([-560, 380, -150], [60, 12, 0.5], [0.3, 0.3]);
SHOTS['bench/close-5'] = bclose([330, 12, 220], [25, 32, 0.3]);
SHOTS['bench/close-6'] = bclose([-610, 0, 300], [-30, 26, 0.42]);
SHOTS['bench/light'] = bench([['lamp', 0.28, 0.35]]);
SHOTS['bench/light-2'] = bench([['lamp', 0.8, 0.65]]);
SHOTS['bench/making'] = bench([['piece:workbench.setMaking', true]]);
SHOTS['bench/rest-desktop'] = bench([]);
SHOTS['bench/rest-phone'] = bench([], { vp: 'phone' });
SHOTS['bench/entrance'] = bench([['opening', 0]], { strip: { times: steps12(0, 4.6), frame: [['opening', '$t']], cols: 4, caption: (t) => `${t.toFixed(2)} s` } });
SHOTS['bench/water'] = bench([['piece:workbench.aim', 0, 140, 200], ['piece:workbench.view', 4, 22, 2.25], ['piece:workbench.water', 0]], { strip: { times: steps8(700, 3100).map(Math.round), frame: [['piece:workbench.water', '$t']], cols: 4, caption: (t) => `water at ${t} mm` } });

// ---- handheld: /lab/piece/handheld, the piece alone at rest ----------------------------------------
// aim takes millimetres of the room (plinth top y 0, the console leans back over z 0); view takes degrees and metres.
const hand = (steps, extra = {}) => ({ route: '/lab/piece/handheld/', vp: 'desktop', steps: [['freeze', 10], ['lamp', 0.55, 0.3], ...steps], ...extra });
const hclose = (aim, view, lamp = [0.5, 0.5]) => hand([['lamp', ...lamp], ['piece:handheld.aim', ...aim], ['piece:handheld.view', ...view]]);
SHOTS['handheld/form'] = hand([['piece:handheld.clay', true], ['piece:handheld.view', -32, 18, 0.62]]);
SHOTS['handheld/close-1'] = hclose([-77, 63, 3.7], [-10, 18, 0.13]);
SHOTS['handheld/close-2'] = hclose([74, 56, 3.7], [16, 14, 0.13], [0.62, 0.45]);
SHOTS['handheld/close-3'] = hclose([0, 60.9, 2.5], [6, 16, 0.14]);
SHOTS['handheld/close-4'] = hclose([-13, 25.9, 11.2], [-6, 20, 0.12]);
SHOTS['handheld/close-5'] = hclose([-40, 95.3, -20.5], [-25, 35, 0.17]);
SHOTS['handheld/close-6'] = hclose([95, 44.3, -5.8], [62, 12, 0.15], [0.8, 0.4]);
SHOTS['handheld/light'] = hand([['lamp', 0.25, 0.3]]);
SHOTS['handheld/light-2'] = hand([['lamp', 0.8, 0.65]]);
SHOTS['handheld/making'] = hand([['piece:handheld.setMaking', true]]);
SHOTS['handheld/rest-desktop'] = hand([]);
SHOTS['handheld/rest-phone'] = hand([], { vp: 'phone' });
SHOTS['handheld/entrance'] = hand([['opening', 0]], { strip: { times: steps12(0, 4.2), frame: [['opening', '$t']], cols: 4, caption: (t) => `${t.toFixed(2)} s` } });

// ---- home: the page itself ------------------------------------------------------------------------
for (const v of VPS) SHOTS['home/hero-' + v] = { route: '/', vp: v, steps: [['freeze', 30], ['lamp', 0.62, 0.3]] };
const section = (id) => (v) => ({ route: '/', vp: v, steps: [['scrollTo', id], ['freeze', 30], ['lamp', 0.6, 0.35]] });
for (const v of VPS) { SHOTS['home/work-' + v] = section('work')(v); SHOTS['home/clients-' + v] = section('clients')(v); SHOTS['home/skills-' + v] = section('skills-desk')(v); }
// ---- page: one route per screen, from its top -------------------------------------------------------
const pageShot = (route) => (v) => ({ route, vp: v, steps: [['freeze', 30], ['lamp', 0.6, 0.35]] });
for (const v of VPS) SHOTS['page/skills-' + v] = { route: '/skills/', vp: v, steps: [['scrollTo', 'skills-desk'], ['freeze', 30], ['lamp', 0.6, 0.35]] };

// ---- tier: the hero and a room at the lower tiers ----------------------------------------------------
for (const tr of ['mid', 'low', 'static']) SHOTS['tier/hero-' + tr] = { route: '/', vp: 'desktop', tier: tr, steps: [['freeze', 30], ['lamp', 0.62, 0.3]] };

export { SHOTS };

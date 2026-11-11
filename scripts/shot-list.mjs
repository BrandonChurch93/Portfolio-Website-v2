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

void VPS;

export { SHOTS };

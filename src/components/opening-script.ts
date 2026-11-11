import { HERO } from '../config/site';

// Runs in <head> before the first paint, on whichever page a visit starts: marks <html> when the home page's opening
// will play (not played this tab's session, motion allowed), so the hero paints the opening's start, never the
// finished city then a dark screen. Same rule as PieceView's `once`. The hero clears the mark when the opening ends.
export const decideOpening = `try{var s=sessionStorage.getItem('played:${HERO.once}')==='1',r=matchMedia('(prefers-reduced-motion: reduce)').matches;if(!s&&!r)document.documentElement.dataset.opening='play'}catch(e){}`;

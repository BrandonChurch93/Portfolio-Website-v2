import type { Tier } from '../config/site';
import type { Piece, PieceFactory, PieceOptions } from './piece';

// The smallest thing that keeps the piece contract: a 2D canvas that marks where the lamp is. The swap test
// (gauntlet E2) mounts it in place of a real piece, to prove a page needs nothing from a piece but the contract.
export const createStub: PieceFactory = (): Piece => {
  let canvas: HTMLCanvasElement | null = null;
  let lamp = { x: 0.5, y: 0.5 };
  let state = { progress: 0, water: 0, making: false, tier: 'high' as Tier, frozen: null as number | null };
  const draw = () => {
    const c = canvas?.getContext('2d');
    if (!c || !canvas) return;
    c.clearRect(0, 0, canvas.width, canvas.height);
    c.fillStyle = state.making ? 'rgba(255,157,60,0.35)' : 'rgba(255,157,60,0.6)';
    c.beginPath();
    c.arc(lamp.x * canvas.width, lamp.y * canvas.height, Math.min(canvas.width, canvas.height) * 0.1, 0, Math.PI * 2);
    c.fill();
  };
  return {
    async mount(host: HTMLElement, opts: PieceOptions) {
      canvas = document.createElement('canvas');
      canvas.dataset.stub = '1';
      canvas.width = Math.max(1, host.clientWidth);
      canvas.height = Math.max(1, host.clientHeight);
      canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
      host.prepend(canvas);
      state.tier = opts.tier;
      draw();
      opts.onReady?.();
    },
    setLamp(x, y) { lamp = { x, y }; draw(); },
    setProgress(p) { state.progress = p; },
    setWaterLight(k) { state.water = k; },
    setMaking(on) { state.making = on; draw(); },
    setTier(t) { state.tier = t; },
    freeze(t) { state.frozen = t; },
    view() { draw(); },
    dispose() { canvas?.remove(); canvas = null; state = { ...state }; },
  };
};

'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { PIECE_MOUNT, ROOM } from '../config/site';
import { registry } from '../hooks/registry';
import { lamp } from '../lamp/lamp';
import { smallLoaders } from '../pieces/load';
import { clock } from '../world/clock';
import type { SmallView } from '../world/small';
import { pixelRatioFor } from '../world/tier-choice';
import { budget, distanceOf } from '../world/budget';
import { tiers } from '../world/tier';

type Room = keyof typeof ROOM.pieces;

// The small live views in the doors to the rooms: one renderer, off the page, draws each room's piece at rest into a
// corner of itself and copies it into the door's own canvas, so the three views are one WebGL context. They draw only
// while the doors are in view; on the low and static tiers each draws once and holds, as a still.
export function DoorViews({ rooms }: { rooms: readonly Room[] }) {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = box.current?.closest('[data-doors]') as HTMLElement | null;
    if (!root) return;
    let alive = true;
    let visible = false;
    let renderer: THREE.WebGLRenderer | null = null;
    const views: { room: Room; piece: string; host: HTMLElement; canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; view: SmallView | null; drawn: boolean }[] = [];
    let lampPage = { x: innerWidth * 0.6, y: innerHeight * 0.35 };
    const offs: (() => void)[] = [];

    for (const room of rooms) {
      const host = root.querySelector(`[data-room="${room}"]`) as HTMLElement | null;
      if (!host) continue;
      const canvas = document.createElement('canvas');
      canvas.setAttribute('aria-hidden', 'true');
      canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;border-radius:inherit';
      host.style.position = 'relative';
      host.style.overflow = 'hidden';
      host.appendChild(canvas);
      views.push({ room, piece: ROOM.pieces[room], host, canvas, ctx: canvas.getContext('2d')!, view: null, drawn: false });
    }

    // The renderer exists only while the doors are near and hold a place in the budget of contexts. Taken down, each
    // door's canvas keeps its last frame, so the doors show a still and never an empty box.
    let gen = 0;
    const teardown = () => {
      gen++;
      for (const v of views) { v.view?.dispose(); v.view = null; v.drawn = false; }
      renderer?.dispose();
      renderer?.forceContextLoss();
      renderer = null;
      root.dataset.live = '0';
    };
    const setup = async () => {
      const my = ++gen;
      const r = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
      renderer = r;
      root.dataset.live = '1';
      r.toneMapping = THREE.NeutralToneMapping;
      r.outputColorSpace = THREE.SRGBColorSpace;
      r.shadowMap.enabled = true;
      r.shadowMap.type = THREE.PCFShadowMap;
      r.setScissorTest(true);
      await Promise.all(['500 20px "Sora Variable"', '600 20px "Sora Variable"', '600 20px "JetBrains Mono Variable"'].map((f) => document.fonts.load(f).catch(() => null)));
      for (const v of views) {
        const load = smallLoaders[v.piece];
        if (!load || !alive || gen !== my) return;
        const make = await load();
        if (gen !== my) return;
        const view = await make(r);
        if (gen !== my) { view.dispose(); return; }
        v.view = view;
        await r.compileAsync(view.scene, view.camera);
      }
      if (gen === my) draw(true);
    };
    let evicted = false;
    const id = 'doors';
    const check = () => {
      const d = distanceOf(root), vh = innerHeight;
      if (d < vh * PIECE_MOUNT.near) {
        if (!renderer && !evicted) {
          if (budget.claim(id, { distance: () => distanceOf(root), keepsStill: true, release: () => { evicted = true; teardown(); } })) registry.track(setup());
          else evicted = true;
        }
      } else if (d > vh * PIECE_MOUNT.far) {
        evicted = false;
        if (renderer) teardown();
        budget.drop(id);
      }
    };
    addEventListener('scroll', check, { passive: true });
    addEventListener('resize', check);
    offs.push(() => { removeEventListener('scroll', check); removeEventListener('resize', check); });
    offs.push(budget.onFree(() => { if (alive && evicted) { evicted = false; check(); } }));
    check();

    const draw = (force = false) => {
      if (!renderer || !alive || (!visible && !force)) return;
      const tier = tiers.get();
      const still = tier === 'low' || tier === 'static';
      const dpr = devicePixelRatio || 1;
      let maxW = 1, maxH = 1;
      const rects = views.map((v) => v.host.getBoundingClientRect());
      for (const r of rects) { maxW = Math.max(maxW, r.width); maxH = Math.max(maxH, r.height); }
      const ratio = pixelRatioFor(tier, dpr, maxW * maxH);
      const W = Math.ceil(maxW * ratio), H = Math.ceil(maxH * ratio);
      const size = renderer.getSize(new THREE.Vector2());
      if (size.x !== W || size.y !== H) { renderer.setPixelRatio(1); renderer.setSize(W, H, false); }
      const t = clock.now();
      views.forEach((v, i) => {
        if (!v.view) return;
        if (still && v.drawn && !force) return;
        const r = rects[i];
        if (r.bottom < -50 || r.top > innerHeight + 50) return;
        const w = Math.max(1, Math.round(r.width * ratio)), h = Math.max(1, Math.round(r.height * ratio));
        if (v.canvas.width !== w || v.canvas.height !== h) { v.canvas.width = w; v.canvas.height = h; }
        const lampUV = { x: (lampPage.x - r.left) / Math.max(1, r.width), y: (lampPage.y - r.top) / Math.max(1, r.height) };
        v.view.update(t, lampUV, r.width / Math.max(1, r.height));
        renderer!.toneMappingExposure = ROOM.exposure[v.piece as keyof typeof ROOM.exposure] ?? 1;
        renderer!.setViewport(0, H - h, w, h);
        renderer!.setScissor(0, H - h, w, h);
        renderer!.render(v.view.scene, v.view.camera);
        v.ctx.clearRect(0, 0, w, h);
        v.ctx.drawImage(renderer!.domElement, 0, 0, w, h, 0, 0, w, h);
        v.drawn = true;
      });
    };

    const io = new IntersectionObserver((es) => { visible = es.some((e) => e.isIntersecting); if (visible) draw(true); }, { rootMargin: '100px' });
    io.observe(root);
    offs.push(() => io.disconnect());
    offs.push(lamp.subscribe((s) => { lampPage = { x: s.px, y: s.py }; }));
    offs.push(clock.onFrame(() => draw(clock.isFrozen())));
    const onResize = () => { for (const v of views) v.drawn = false; draw(true); };
    addEventListener('resize', onResize);
    offs.push(() => removeEventListener('resize', onResize));
    offs.push(tiers.subscribe(() => { for (const v of views) v.drawn = false; draw(true); }));

    return () => {
      alive = false;
      for (const o of offs) o();
      teardown();
      budget.drop(id);
      for (const v of views) v.canvas.remove();
    };
  }, [rooms]);

  return <div ref={box} hidden />;
}

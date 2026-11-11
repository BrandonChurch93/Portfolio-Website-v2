'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { PIECE_MOUNT, READING_LINE } from '../config/site';
import { site } from '../content/site';
import { registry, type PieceHandle } from '../hooks/registry';
import { lamp } from '../lamp/lamp';
import { loaderFor } from '../pieces/load';
import { budget, distanceOf } from '../world/budget';
import { tiers } from '../world/tier';
import type { Piece } from '../world/piece';
import styles from './PieceView.module.css';

interface Props {
  name: string;
  // Play the piece's entrance. With `once`, it plays only on the first visit of this tab's session.
  entrance?: boolean;
  once?: string;
  making?: boolean;
  className?: string;
  onReady?: () => void;
  frame?: { shift?: number; scale?: number; x?: number };
  entranceFrom?: number;
  // Called with the mounted piece (and null when it goes), for a page that times things to it.
  onPiece?: (p: Piece | null) => void;
  children?: ReactNode;
  switchSide?: 'left' | 'right';
}

type Extra = Piece & { opening?: (t: number | null) => void; skip?: () => void };

// Hosts one 3D piece: mounts it near the viewport, feeds it the lamp and the tier, registers it for the test hooks,
// and offers the "how this is made" switch.
export function PieceView({ name, entrance = false, once, making = true, className, onReady, frame, entranceFrom, onPiece, children, switchSide = 'right' }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const [isMaking, setMaking] = useState(false);
  const piece = useRef<Extra | null>(null);

  useEffect(() => {
    const h = host.current;
    const load = loaderFor(name);
    if (!h || !load) return;
    let alive = true;
    let offs: (() => void)[] = [];
    let mounted: Extra | null = null;
    let loading: Promise<void> | null = null;
    let played = false;
    tiers.detect();
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const seen = once ? sessionStorage.getItem(`played:${once}`) === '1' : false;
    const start = async () => {
      const make = await load();
      if (!alive) return;
      const p = make() as Extra;
      // The entrance plays on the first mount only; coming back later the piece is already at rest.
      const play = entrance && !reduced && !seen && !played;
      played = true;
      await p.mount(h, { tier: tiers.get(), entrance: play, onReady, frame, entranceFrom: play ? entranceFrom : 0 });
      if (!alive || !near || evicted) { p.dispose(); loading = null; budget.drop(id); return; }
      mounted = p;
      piece.current = p;
      onPiece?.(p);
      if (once && play) sessionStorage.setItem(`played:${once}`, '1');
      registry.piece(name, p as unknown as PieceHandle);
      if (p.opening) registry.opening((t) => p.opening?.(t));
      // The host's place is read on scroll and resize, not each time the lamp moves (every frame), when reading it
      // would force the page to lay out again after the frame's writes.
      let r = h.getBoundingClientRect();
      const place = () => { r = h.getBoundingClientRect(); };
      const hostObs = new ResizeObserver(place);
      hostObs.observe(h);
      offs.push(() => hostObs.disconnect());
      offs.push(lamp.subscribe((s) => {
        p.setLamp((s.px - r.left) / Math.max(1, r.width), (s.py - r.top) / Math.max(1, r.height));
      }));
      offs.push(tiers.subscribe((t) => p.setTier(t)));
      // Progress: how far the page's reading line (two thirds down the viewport, where the water's head is) has
      // passed through the host, as a fraction of its height. 0 is its top, 1 its bottom.
      const prog = () => { place(); p.setProgress((innerHeight * READING_LINE - r.top) / Math.max(1, r.height)); };
      addEventListener('scroll', prog, { passive: true });
      addEventListener('resize', prog);
      offs.push(() => { removeEventListener('scroll', prog); removeEventListener('resize', prog); });
      prog();
      // Any input skips an opening that plays once per visit (the hero's), never an entrance met while scrolling.
      if (play && once && p.skip) {
        const skip = () => p.skip?.();
        const evs = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
        for (const e of evs) addEventListener(e, skip, { once: true, passive: true });
        offs.push(() => { for (const e of evs) removeEventListener(e, skip); });
      }
      loading = null;
    };
    const stop = () => {
      for (const o of offs) o();
      offs = [];
      if (mounted) {
        registry.piece(name, null);
        onPiece?.(null);
        mounted.dispose();
        mounted = null;
        piece.current = null;
      }
      budget.drop(id);
    };
    // Mount when the host comes within a screen of the viewport; dispose when it is three screens away, so only the
    // pieces near the visitor hold a WebGL context.
    // Within the budget of contexts (src/world/budget.ts): a piece that gives way waits for a place to come free.
    let near = false;
    let evicted = false;
    const id = `piece:${name}`;
    const check = () => {
      const dist = distanceOf(h), vh = innerHeight;
      if (dist < vh * PIECE_MOUNT.near) {
        near = true;
        if (!mounted && !loading && !evicted) {
          if (budget.claim(id, { distance: () => distanceOf(h), keepsStill: false, release: () => { evicted = true; stop(); } })) loading = registry.track(start());
          else evicted = true;
        }
      } else if (dist > vh * PIECE_MOUNT.far) {
        near = false;
        evicted = false;
        stop();
      }
    };
    const offFree = budget.onFree(() => { if (alive && evicted) { evicted = false; check(); } });
    addEventListener('scroll', check, { passive: true });
    addEventListener('resize', check);
    check();
    return () => {
      alive = false;
      offFree();
      removeEventListener('scroll', check);
      removeEventListener('resize', check);
      stop();
    };
  }, [name, entrance, once]);

  const toggle = () => {
    const next = !isMaking;
    setMaking(next);
    piece.current?.setMaking(next);
  };

  return (
    <div ref={host} className={`${styles.host} ${className ?? ''}`} data-piece={name} data-switch={switchSide}>
      {children}
      {making && (
        <button type="button" className={styles.making} aria-pressed={isMaking} onClick={toggle}>
          <span className={styles.dot} aria-hidden="true" />
          {isMaking ? site.ui.makingOn : site.ui.making}
        </button>
      )}
    </div>
  );
}

'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { site } from '../content/site';
import { registry, type PieceHandle } from '../hooks/registry';
import { lamp } from '../lamp/lamp';
import { pieceLoaders } from '../pieces/load';
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
  frame?: { shift?: number; scale?: number };
  entranceFrom?: number;
  // Called with the mounted piece (and null when it goes), for a page that times things to it.
  onPiece?: (p: Piece | null) => void;
  children?: ReactNode;
}

type Extra = Piece & { opening?: (t: number | null) => void; skip?: () => void };

// Hosts one 3D piece: mounts it near the viewport, feeds it the lamp and the tier, registers it for the test hooks,
// and offers the "how this is made" switch.
export function PieceView({ name, entrance = false, once, making = true, className, onReady, frame, entranceFrom, onPiece, children }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const [isMaking, setMaking] = useState(false);
  const piece = useRef<Extra | null>(null);

  useEffect(() => {
    const h = host.current;
    const load = pieceLoaders[name];
    if (!h || !load) return;
    let alive = true;
    const offs: (() => void)[] = [];
    tiers.detect();
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const seen = once ? sessionStorage.getItem(`played:${once}`) === '1' : false;
    const play = entrance && !reduced && !seen;
    const start = async () => {
      const make = await load();
      if (!alive) return;
      const p = make() as Extra;
      await p.mount(h, { tier: tiers.get(), entrance: play, onReady, frame, entranceFrom: play ? entranceFrom : 0 });
      if (!alive) { p.dispose(); return; }
      piece.current = p;
      onPiece?.(p);
      if (once && play) sessionStorage.setItem(`played:${once}`, '1');
      registry.piece(name, p as unknown as PieceHandle);
      if (p.opening) registry.opening((t) => p.opening?.(t));
      offs.push(lamp.subscribe((s) => {
        const r = h.getBoundingClientRect();
        p.setLamp((s.px - r.left) / Math.max(1, r.width), (s.py - r.top) / Math.max(1, r.height));
      }));
      offs.push(tiers.subscribe((t) => p.setTier(t)));
      if (play && p.skip) {
        const skip = () => p.skip?.();
        const evs = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
        for (const e of evs) addEventListener(e, skip, { once: true, passive: true });
        offs.push(() => { for (const e of evs) removeEventListener(e, skip); });
      }
    };
    registry.track(start());
    return () => {
      alive = false;
      for (const o of offs) o();
      registry.piece(name, null);
      onPiece?.(null);
      piece.current?.dispose();
      piece.current = null;
    };
  }, [name, entrance, once]);

  const toggle = () => {
    const next = !isMaking;
    setMaking(next);
    piece.current?.setMaking(next);
  };

  return (
    <div ref={host} className={`${styles.host} ${className ?? ''}`} data-piece={name}>
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

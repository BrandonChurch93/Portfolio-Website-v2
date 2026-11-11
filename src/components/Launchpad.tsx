'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { CONTACT } from '../config/site';
import { site } from '../content/site';
import type { Piece } from '../world/piece';
import { PieceView } from './PieceView';
import styles from './Launchpad.module.css';

type Rocket = Piece & { anchor?: (edge: number) => { x: number; y: number } | null };

// How far in from each side the stage has faded into the page (Launchpad.module.css): the stream joins the flume there,
// coming down the gutter through the fade.
const FADE = 0.07;

// The rocket on its pad at the end of the page, with the section's words set in its sky on wide screens and above it
// on narrow ones. The page's stream ends here: it comes level into the stage where the
// rocket's flume leaves the frame, and the piece carries it on along the flume into the pool (data-water-at, a
// fraction of this box, from the point the piece projects).
export function Launchpad({ children }: { children?: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState<{ shift: number; scale: number; x: number } | null>(null);

  useEffect(() => {
    // The stage is the last screen of the page: the footer sits over its faded foot, so at the end of the page (where
    // the rocket lifts off) the whole stage is in view. The scene is framed into the part above the footer.
    const el = wrap.current, pad = box.current;
    if (!el || !pad) return;
    el.style.marginBottom = '0px';
    const foot = document.querySelector('footer');
    const end = document.documentElement.scrollHeight;
    const bottom = pad.getBoundingClientRect().bottom + scrollY;
    el.style.marginBottom = `${-Math.max(0, end - bottom)}px`;
    // The switch and the readout sit above the footer, not under its words.
    pad.style.setProperty('--host-foot', `${foot?.offsetHeight ?? 0}px`);
    const covered = foot ? Math.min(0.45, foot.offsetHeight / Math.max(1, pad.clientHeight)) : 0;
    const a = pad.clientWidth / Math.max(1, pad.clientHeight - (foot?.offsetHeight ?? 0));
    const base = a >= 1.15 ? CONTACT.frame.wide : a >= 0.65 ? CONTACT.frame.upright : CONTACT.frame.tall;
    setFrame({ shift: base.shift - covered / 2, scale: base.scale / (1 - covered), x: base.x });
  }, []);

  const onPiece = useCallback((p: Piece | null) => {
    const a = (p as Rocket | null)?.anchor?.(FADE);
    const el = box.current;
    if (!a || !el) return;
    el.dataset.waterAt = `${a.x.toFixed(4)},${a.y.toFixed(4)}`;
    dispatchEvent(new Event('resize'));
  }, []);

  return (
    <div ref={wrap} className={styles.contact}>
      <div className={styles.words}>{children}</div>
      <div ref={box} id="pad" className={styles.pad} data-water="pool" data-water-id="pad" data-water-at="0,0.86">
        <div className={styles.label} role="img" aria-label={site.contact.rocketAlt} />
        {frame ? <PieceView name="rocket" entrance frame={frame} className={styles.stage} onPiece={onPiece} /> : null}
      </div>
    </div>
  );
}

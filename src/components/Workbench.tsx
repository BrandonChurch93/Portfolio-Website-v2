'use client';

import { useCallback, useRef } from 'react';
import { site } from '../content/site';
import type { Piece } from '../world/piece';
import { PieceView } from './PieceView';
import styles from './Workbench.module.css';

type Bench = Piece & { anchor?: () => { land: { x: number; y: number }; pour: { x: number; y: number } } | null };

// The workbench in the skills section: the desk in its fixed light. The page's stream falls onto the desk's front
// left corner and leaves from its front right corner; the piece draws the water on the desk itself, so the two meet
// at the points the piece projects (data-water-from and data-water-to, fractions of this box).
export function Workbench({ className }: { className?: string }) {
  const box = useRef<HTMLDivElement>(null);

  const onPiece = useCallback((p: Piece | null) => {
    const a = (p as Bench | null)?.anchor?.();
    const el = box.current;
    if (!a || !el) return;
    el.dataset.waterFrom = `${a.land.x.toFixed(4)},${a.land.y.toFixed(4)}`;
    el.dataset.waterTo = `${a.pour.x.toFixed(4)},${a.pour.y.toFixed(4)}`;
    dispatchEvent(new Event('resize'));
  }, []);

  return (
    <div ref={box} id="skills-desk" className={`${styles.desk} ${className ?? ''}`} data-water="edge" data-water-id="bench" data-water-from="0.06,0.62" data-water-to="0.92,0.7">
      <div className={styles.label} role="img" aria-label={site.skills.deskAlt} />
      <PieceView name="workbench" entrance className={styles.stage} switchSide="left" onPiece={onPiece} />
    </div>
  );
}

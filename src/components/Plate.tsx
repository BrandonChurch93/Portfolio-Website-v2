'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { Finish } from '../content/site';
import type { PlateKind } from '../metal/mask';
import { plates, type PlatePhoto } from '../metal/renderer';
import styles from './Plate.module.css';

export interface PlateProps {
  finish: Finish;
  kind?: PlateKind;
  label?: string;
  big?: string;
  facts?: string;
  photo?: PlatePhoto;
  className?: string;
  style?: CSSProperties;
  tilt?: boolean;
  // What screen readers and search read. Defaults to the plate's words. The words are always in the DOM.
  children?: ReactNode;
}

const MAX_TILT = 0.06;

// A lit metal plate. Its words are painted into the metal and also kept in the DOM.
export function Plate({ finish, kind = 'plate', label, big, facts, photo, className, style, tilt = true, children }: PlateProps) {
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const photoKey = photo ? `${photo.src}|${photo.video ? 'v' : 'i'}` : '';

  useEffect(() => {
    const h = host.current;
    const c = canvas.current;
    if (!h || !c) return;
    const off = plates.add({
      host: h,
      canvas: c,
      spec: { finish, kind, label, big, facts, window: !!photo },
      photo,
      onState: (s) => setState(s),
    });
    return off;
    // The spec is fixed for a plate's life; a new photo or new words make a new plate.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finish, kind, label, big, facts, photoKey]);

  useEffect(() => {
    const h = host.current;
    if (!h || !tilt) return;
    const move = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      const r = h.getBoundingClientRect();
      plates.setTilt(h, -((e.clientY - r.top) / r.height - 0.5) * MAX_TILT, ((e.clientX - r.left) / r.width - 0.5) * MAX_TILT * 1.2);
    };
    const leave = () => plates.setTilt(h, 0, 0);
    h.addEventListener('pointermove', move);
    h.addEventListener('pointerleave', leave);
    return () => { h.removeEventListener('pointermove', move); h.removeEventListener('pointerleave', leave); };
  }, [tilt]);

  return (
    <div ref={host} className={`${styles.plate} ${className ?? ''}`} style={style} data-kind={kind} data-finish={finish} data-state={state}>
      <div className={styles.shadow} aria-hidden="true" />
      <canvas ref={canvas} className={styles.canvas} aria-hidden="true" />
      <div className={state === 'failed' ? styles.plain : 'visually-hidden'} data-plate-text="">
        {children ?? (
          <>
            {label ? <span className={styles.plainLabel}>{label}</span> : null}
            {big ? <span className={styles.plainBig}>{big}</span> : null}
            {facts ? <span className={styles.plainFacts}>{facts}</span> : null}
          </>
        )}
      </div>
    </div>
  );
}

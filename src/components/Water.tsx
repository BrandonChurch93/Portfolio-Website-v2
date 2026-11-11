'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { registry } from '../hooks/registry';
import { tiers } from '../world/tier';
import styles from './Water.module.css';

// The water on every page: one fixed canvas above the page background and below the words.
export function Water() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const path = usePathname();

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    let alive = true;
    let sys: { destroy(): void } | null = null;
    const start = async () => {
      // A lab page that shows one thing alone turns the water off.
      if (document.querySelector('[data-water-off]')) return;
      if (!document.createElement('canvas').getContext('webgl2')) return;
      const { WaterSystem } = await import('../water/system');
      if (!alive) return;
      const approach = new URLSearchParams(location.search).get('approach') === 'a' ? 'a' : 'b';
      const entering = !document.querySelector('[data-water-start]');
      try {
        sys = new WaterSystem(c, { approach, entering });
      } catch {
        sys = null;
      }
    };
    tiers.detect();
    registry.track(start());
    return () => { alive = false; sys?.destroy(); };
  }, [path]);

  return <canvas ref={canvas} className={styles.water} aria-hidden="true" />;
}

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { HERO } from '../config/site';
import { site } from '../content/site';
import { clock } from '../world/clock';
import type { Piece } from '../world/piece';
import { PieceView } from './PieceView';
import styles from './Hero.module.css';

type City = Piece & { openingState?: () => { t: number; end: number }; anchor?: () => { x: number; y: number } | null };

const smooth = (k: number) => { const c = Math.min(1, Math.max(0, k)); return c * c * (3 - 2 * c); };

// The home hero: the city fills the first screen, builds itself, settles low, and the headline arrives above it.
// The front fall's landing is where the page's stream starts.
export function Hero() {
  const words = useRef<HTMLDivElement>(null);
  const start = useRef<HTMLDivElement>(null);
  const city = useRef<City | null>(null);
  const [ready, setReady] = useState(false);
  const [frame, setFrame] = useState<{ shift: number; scale: number } | null>(null);

  const place = useCallback(() => {
    const a = city.current?.anchor?.();
    const el = start.current;
    if (!a || !el) return;
    el.style.left = `${(a.x * 100).toFixed(3)}%`;
    el.style.top = `${(a.y * 100).toFixed(3)}%`;
    dispatchEvent(new Event('resize'));
  }, []);

  const onPiece = useCallback((p: Piece | null) => {
    city.current = p as City | null;
    if (p) { setReady(true); place(); }
  }, [place]);

  useEffect(() => { const a = innerWidth / innerHeight; setFrame(a >= 1 ? HERO.frame.wide : a >= 0.6 ? HERO.frame.upright : HERO.frame.tall); }, []);

  useEffect(() => {
    const show = () => {
      const w = words.current;
      if (!w) return;
      const s = city.current?.openingState?.();
      const playing = document.documentElement.dataset.opening === 'play';
      // The opening has played: a later visit to the home page (by a link) starts from the city at rest.
      if (playing && s && s.t >= s.end) delete document.documentElement.dataset.opening;
      const k = s ? smooth((s.t - (s.end - HERO.wordsIn[0])) / (HERO.wordsIn[0] - HERO.wordsIn[1])) : playing ? 0 : 1;
      w.style.opacity = k.toFixed(3);
      w.style.transform = `translateY(${((1 - k) * 18).toFixed(2)}px)`;
      // The page's stream waits for the city's own water to pour off the rim and land.
      const src = start.current;
      if (src) { const hold = playing && !!s && s.t < HERO.waterFrom; if ((src.dataset.waterHold === '1') !== hold) src.dataset.waterHold = hold ? '1' : ''; }
    };
    const off = clock.onFrame(show);
    const ro = new ResizeObserver(() => place());
    if (start.current?.parentElement) ro.observe(start.current.parentElement);
    show();
    return () => { off(); ro.disconnect(); };
  }, [place]);

  return (
    <section id="hero" className={styles.hero} aria-labelledby="hero-title" data-ready={ready ? 'yes' : 'no'}>
      {/* The stills are in the page's HTML, so the first paint shows the city before any script runs. */}
      <div className={`${styles.stage} ${styles.fade}`}>
        <picture className={`${styles.still} ${styles.stillRest}`}>
          <source media="(max-aspect-ratio: 1/1)" srcSet={HERO.stills.city.tall} />
          <img src={HERO.stills.city.wide} alt="" width={1440} height={900} />
        </picture>
        <picture className={`${styles.still} ${styles.stillPlan}`}>
          <source media="(max-aspect-ratio: 1/1)" srcSet={HERO.stills.plan.tall} />
          <img src={HERO.stills.plan.wide} alt="" width={1440} height={900} />
        </picture>
        {frame && <PieceView name="city" entrance once={HERO.once} frame={frame} entranceFrom={HERO.planStillAt} onPiece={onPiece} className={styles.stage} />}
      </div>
      <div className={styles.city} role="img" aria-label={site.hero.cityAlt} />
      <div ref={start} className={styles.source} data-water-start="" />
      <div ref={words} className={styles.words}>
        <h1 id="hero-title" className={styles.headline} data-water-avoid="">{site.hero.headline}</h1>
        <div className={styles.aside} data-water-avoid="">
          <p className={styles.sub}>{site.hero.sub}</p>
        </div>
      </div>
    </section>
  );
}

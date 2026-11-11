'use client';

import { useId, useState } from 'react';
import { PORTRAIT_CUT } from '../config/site';
import { site } from '../content/site';
import { MetalButton, onTabKeys } from './MetalButton';
import styles from './About.module.css';

// About on the home page: three short tabs beside a large portrait. Brandon is cut out of his photograph and has no
// frame: he shifts a little against the lamp, and the water sweeps in behind him at an angle and lights his outline.
// The panels share one cell, so changing tab never moves the page.
export function About({ headingId }: { headingId: string }) {
  const a = site.about;
  const [tab, setTab] = useState<string>(a.tabs[0].id);
  const base = useId();
  return (
    <div className={styles.about}>
      <div className={styles.words} data-water-avoid="">
        <h2 id={headingId} className={styles.eyebrow}>{a.heading}</h2>
        <div role="tablist" aria-label={a.tabsLabel} className={styles.tabs} onKeyDown={onTabKeys}>
          {a.tabs.map((x) => (
            <MetalButton key={x.id} id={`${base}-${x.id}`} controls={`${base}-panel-${x.id}`} label={x.name} selected={x.id === tab} onSelect={() => setTab(x.id)} />
          ))}
        </div>
        <div className={styles.panels}>
          {a.tabs.map((x) => (
            <div key={x.id} role="tabpanel" id={`${base}-panel-${x.id}`} aria-labelledby={`${base}-${x.id}`} className={styles.panel} data-on={x.id === tab ? 'yes' : 'no'} aria-hidden={x.id !== tab} inert={x.id !== tab}>
              <p className={styles.lead}>{x.lead}</p>
              {x.body.map((p) => <p key={p}>{p}</p>)}
            </div>
          ))}
        </div>
      </div>
      <figure className={styles.portrait} id="about-portrait" data-water="behind" data-water-at="0.51,0.6">
        <span className={styles.aura} aria-hidden="true" />
        <img
          className={styles.photo}
          src={PORTRAIT_CUT.srcs[PORTRAIT_CUT.srcs.length - 1].src}
          srcSet={PORTRAIT_CUT.srcs.map((x) => `${x.src} ${x.w}w`).join(', ')}
          sizes="(max-width: 820px) 96vw, 48vw"
          width={PORTRAIT_CUT.w}
          height={PORTRAIT_CUT.h}
          alt={a.portrait.alt}
          loading="lazy"
          decoding="async"
        />
      </figure>
    </div>
  );
}

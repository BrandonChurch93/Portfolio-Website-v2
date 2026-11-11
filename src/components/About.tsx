'use client';

import { useId, useState } from 'react';
import { BREAKPOINT_ONE_COLUMN } from '../config/site';
import { site } from '../content/site';
import { MetalButton, onTabKeys } from './MetalButton';
import { Picture } from './Picture';
import styles from './About.module.css';

// About on the home page: three short tabs beside a large portrait. The portrait has no frame. Its edges fade into the
// page, it shifts a little against the lamp, and the water runs down behind it. The panels share one cell, so
// changing tab never moves the page.
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
      <figure className={styles.portrait} id="about-portrait" data-water="weave" data-water-id="portrait" data-water-above={BREAKPOINT_ONE_COLUMN} data-water-line="#about-portrait">
        <Picture media={a.portrait} sizes="(max-width: 820px) 92vw, 44vw" className={styles.photo} />
      </figure>
    </div>
  );
}

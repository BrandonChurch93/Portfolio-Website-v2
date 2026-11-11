'use client';

import { site } from '../../content/site';
import { MEDIA } from '../../content/media.generated';
import { Plate } from '../Plate';
import styles from './MetalLab.module.css';

const s = site.lab.sample;
const photoSrc = (id: keyof typeof MEDIA) => MEDIA[id].srcs[MEDIA[id].srcs.length - 1].src;

// One specimen per section, so a shot can frame each alone.
export function MetalLab() {
  return (
    <div className={styles.lab} data-water-off="">
      {(['aged', 'polished', 'bronze', 'panel'] as const).map((f) => (
        <section key={f} id={f} className={styles.spec}>
          <Plate finish={f} label={s.label} big={s.big} facts={s.facts} className={styles.plate} />
        </section>
      ))}
      <section id="text" className={styles.spec}>
        <div className={styles.textRow}>
          <Plate finish="polished" kind="placard" label={site.clients.items[3].name.toUpperCase()} big={site.clients.items[3].what} facts={site.clients.items[3].year} className={styles.placardSmall} />
          <Plate finish="aged" kind="placard" label={site.clients.items[2].name.toUpperCase()} big={site.clients.items[2].what} facts={site.clients.items[2].year} className={styles.placardSmall} />
        </div>
      </section>
      <section id="window" className={styles.spec}>
        <Plate finish="aged" label={s.windowLabel} big={site.work.projects[6].why} facts={s.windowFacts} photo={{ src: photoSrc('meridian'), focus: [0.54, 0.5], zoom: 1.45 }} className={styles.windowPlate} />
      </section>
      <section id="video" className={styles.spec}>
        <Plate finish="aged" label={s.videoLabel} big={site.footer.line} facts={s.videoFacts} photo={{ src: '/media/site-recording.mp4', video: true, focus: [0.5, 0.4] }} className={styles.windowPlate} />
      </section>
      <section id="bar" className={styles.spec}>
        <Plate finish="polished" kind="bar" label={s.bar} className={styles.bar} />
      </section>
      <section id="placard" className={styles.spec}>
        <div className={styles.trio}>
          {site.clients.items.slice(0, 3).map((c, i) => (
            <Plate key={c.name} finish={(['polished', 'bronze', 'panel'] as const)[i]} kind="placard" label={c.name.toUpperCase()} big={c.what} facts={c.year} />
          ))}
        </div>
      </section>
      <section id="eight" className={styles.spec}>
        <div className={styles.eight}>
          {site.clients.items.slice(0, 7).concat(site.clients.items.slice(0, 1)).map((c, i) => (
            <Plate key={i} finish={(['aged', 'polished', 'bronze', 'panel'] as const)[i % 4]} kind="placard" label={c.name.toUpperCase()} big={c.what} facts={c.year} />
          ))}
        </div>
      </section>
      <section id="controls" className={styles.spec}>
        <div className={styles.controls}>
          <Plate finish="polished" kind="control" label={site.work.link} className={styles.control} />
          <Plate finish="aged" kind="control" label={site.ui.resumeDownload} className={styles.control} />
          <Plate finish="polished" kind="control" label={site.notFound.back} className={styles.control} />
        </div>
      </section>
    </div>
  );
}

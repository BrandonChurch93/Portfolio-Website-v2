'use client';

import { site } from '../../content/site';
import { Plate } from '../Plate';
import styles from './WaterLab.module.css';

const m = site.lab.moves;
const p = site.work.projects;
const c = site.clients.items;

// Every move alone, in order down one route. water.move(name, t) jumps to a section and shows it t seconds in.
export function WaterLab() {
  return (
    <div className={styles.lab} data-water-column="">
      <div className={styles.source} data-water-start="" />

      <section id="move-body" className={styles.spec} data-water-touch="move-body">
        <h2 className={styles.label}>{m.body}</h2>
        <p className={styles.text} data-water-avoid="" data-water="weave" data-water-side="right" data-water-id="move-body">{site.hero.sub} {site.about.letter[1]}</p>
      </section>

      <section id="move-run" className={styles.spec} data-water-touch="move-run">
        <h2 className={styles.label}>{m.run}</h2>
        <p className={styles.text} data-water-avoid="" data-water="weave" data-water-side="left" data-water-id="move-run">{site.about.letter[2]} {site.skills.areas[3].note}</p>
      </section>

      <section id="move-fall" className={`${styles.spec} ${styles.tall}`} data-water-touch="move-fall:pour" data-water-lead="0.05">
        <h2 className={styles.label}>{m.fall}</h2>
        <div className={styles.ledge} data-water="corner" data-water-side="left" data-water-id="move-fall" data-water-fall="560">
          <Plate finish="polished" kind="bar" label={c[0].name.toUpperCase()} />
        </div>
      </section>

      <section id="move-land" className={styles.spec} data-water-touch="move-land" data-water-lead="0.45">
        <h2 className={styles.label}>{m.land}</h2>
        <div className={styles.plate} data-water="corner" data-water-side="right" data-water-id="move-land">
          <Plate finish="aged" label={`01 · ${p[0].name.toUpperCase()}`} big={p[0].why} facts={p[0].facts.join(' · ').toUpperCase()} />
        </div>
      </section>

      <section id="move-cling" className={styles.spec} data-water-touch="move-cling" data-water-lead="0.1">
        <h2 className={styles.label}>{m.cling}</h2>
        <div className={`${styles.plate} ${styles.right}`} data-water="corner" data-water-side="left" data-water-id="move-cling">
          <Plate finish="bronze" label={`03 · ${p[2].name.toUpperCase()}`} big={p[2].why} facts={p[2].facts.join(' · ').toUpperCase()} />
        </div>
      </section>

      <section id="move-pour" className={styles.spec} data-water-touch="move-pour:pour" data-water-lead="0.6">
        <h2 className={styles.label}>{m.pour}</h2>
        <div className={styles.plate} data-water="corner" data-water-side="left" data-water-id="move-pour">
          <Plate finish="panel" label={`04 · ${p[3].name.toUpperCase()}`} big={p[3].why} facts={p[3].facts.join(' · ').toUpperCase()} />
        </div>
      </section>

      <section id="move-split" className={styles.spec} data-water-touch="move-split" data-water-lead="0.4">
        <h2 className={styles.label}>{m.split}</h2>
        <div className={styles.bar} data-water="split" data-water-frame="#move-frame" data-water-id="move-split">
          <Plate finish="polished" kind="bar" label={site.clients.bar} />
        </div>
        <div id="move-frame" data-water-offset="120" className={styles.frame} data-water-touch="move-split:pourR" data-water-lead="0.15" data-water-avoid="">
          {c.slice(0, 3).map((x, i) => (
            <Plate key={x.name} finish={(['polished', 'bronze', 'panel'] as const)[i]} kind="placard" label={x.name.toUpperCase()} big={x.what} facts={x.year} />
          ))}
        </div>
      </section>

      <section id="move-light" className={styles.spec}>
        <h2 className={styles.label}>{m.light}</h2>
        <div className={styles.lightPlate} data-water="weave" data-water-side="right" data-water-id="move-light">
          <Plate finish="aged" label={`02 · ${p[1].name.toUpperCase()}`} big={p[1].why} facts={p[1].facts.join(' · ').toUpperCase()} />
        </div>
      </section>

      <section id="move-pool" className={`${styles.spec} ${styles.poolSection}`} data-water-touch="move-pool" data-water-lead="0.8">
        <h2 className={styles.label}>{m.pool}</h2>
        <div className={styles.pool} data-water="pool" data-water-id="move-pool" />
      </section>
    </div>
  );
}

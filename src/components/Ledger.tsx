import type { SkillArea } from '../content/site';
import { site } from '../content/site';
import styles from './Ledger.module.css';

// The skills ledger: one wide row per area. Name, a few sentences, the tools, where they were used. Rows, not columns.
export function Ledger({ areas }: { areas: readonly SkillArea[] }) {
  return (
    <ol className={styles.ledger} data-water-avoid="">
      {areas.map((a, i) => (
        <li key={a.name} className={styles.row}>
          <div className={styles.head}>
            <span className={styles.n} aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
            <h3 className={styles.name}>{a.name}</h3>
          </div>
          <p className={styles.note}>{a.note}</p>
          <dl className={styles.meta}>
            {a.tools.length ? (
              <div>
                <dt>{site.ui.toolsLabel}</dt>
                <dd>{a.tools.join(' · ')}</dd>
              </div>
            ) : null}
            <div>
              <dt>{site.ui.usedInLabel}</dt>
              <dd>{a.usedIn.join(' · ')}</dd>
            </div>
          </dl>
        </li>
      ))}
    </ol>
  );
}

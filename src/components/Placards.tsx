import type { Client, Finish } from '../content/site';
import { Plate } from './Plate';
import styles from './Placards.module.css';

const FINISHES: Finish[] = ['aged', 'bronze', 'polished', 'panel'];

// Client work: a polished brass header bar, then small lit placards. On the home page the water lands on the bar,
// splits, and frames the placards.
export function Placards({ items, bar, sub, headingId, water = false }: { items: readonly Client[]; bar: string; sub?: string; headingId?: string; water?: boolean }) {
  const frameId = headingId ? `${headingId}-frame` : undefined;
  return (
    <div className={styles.block}>
      <div className={styles.barWrap} {...(water && frameId ? { 'data-water': 'split', 'data-water-frame': `#${frameId}`, 'data-water-id': 'clients' } : {})}>
        <Plate finish="polished" kind="bar" label={bar.toUpperCase()} className={styles.bar}>
          <h2 id={headingId}>{bar}</h2>
        </Plate>
      </div>
      <div id={frameId} className={styles.frame} data-water-avoid="">
        {sub ? <p className={styles.sub}>{sub}</p> : null}
        <ul className={styles.grid}>
          {items.map((c, i) => (
            <li key={c.name} className={styles.item}>
              <Plate finish={FINISHES[i % FINISHES.length]} kind="placard" label={c.name.toUpperCase()} big={c.what} facts={c.year ?? undefined} className={styles.placard}>
                <h3>{c.name}</h3>
                <p>{c.what}</p>
                {c.year ? <p>{c.year}</p> : null}
              </Plate>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

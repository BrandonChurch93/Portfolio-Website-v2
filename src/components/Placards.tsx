import type { Client } from '../content/site';
import styles from './Placards.module.css';

// Client work: small placards under the header bar. Phase 5 lights them as metal.
export function Placards({ items, bar, sub, headingId }: { items: readonly Client[]; bar: string; sub: string; headingId?: string }) {
  return (
    <div className={styles.block}>
      <h2 className={styles.bar} id={headingId}>{bar}</h2>
      <p className={styles.sub}>{sub}</p>
      <ul className={styles.grid}>
        {items.map((c) => (
          <li key={c.name} className={styles.placard}>
            <h3 className={styles.name}>{c.name}</h3>
            <p className={styles.what}>{c.what}</p>
            {c.year ? <p className={styles.year}>{c.year}</p> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

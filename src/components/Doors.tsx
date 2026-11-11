import Link from 'next/link';
import { ROUTES, SHOW_3D_ART } from '../config/site';
import type { Door } from '../content/site';
import styles from './Doors.module.css';

// The doors to the rooms. Phase 7 puts a small live view of each room's piece in its frame.
export function Doors({ doors }: { doors: readonly Door[] }) {
  const open = doors.filter((d) => d.route !== 'art3d' || SHOW_3D_ART);
  return (
    <ul className={styles.doors} data-count={open.length}>
      {open.map((d) => (
        <li key={d.route} className={styles.door}>
          <Link href={ROUTES[d.route]} className={styles.link} data-door={d.route}>
            <span className={styles.view} aria-hidden="true" data-room={d.route} />
            <span className={styles.words}>
              <span className={styles.name}>{d.name}</span>
              <span className={styles.line}>{d.line}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

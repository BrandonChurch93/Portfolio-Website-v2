import Link from 'next/link';
import { ROOM, ROUTES, SHOW_3D_ART } from '../config/site';
import { DoorViews } from './DoorViews';
import type { Door } from '../content/site';
import styles from './Doors.module.css';

// The doors to the rooms, each with a small live view of its room's piece.
export function Doors({ doors }: { doors: readonly Door[] }) {
  const open = doors.filter((d) => d.route !== 'art3d' || SHOW_3D_ART);
  return (
    <div data-doors="">
    <ul className={styles.doors} data-count={open.length} data-water-avoid="">
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
    <DoorViews rooms={open.map((d) => d.route).filter((r): r is keyof typeof ROOM.pieces => r in ROOM.pieces)} />
    </div>
  );
}

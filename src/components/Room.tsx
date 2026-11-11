import type { ReactNode } from 'react';
import page from './Page.module.css';
import styles from './Room.module.css';
import { RoomStage } from './RoomStage';

// A room page: its piece fills the opening, then the words and the work have the stage.
export function Room({ heading, sub, note, pieceAlt, piece, children }: { heading: string; sub: string; note?: string; pieceAlt: string; piece: string; children?: ReactNode }) {
  return (
    <main id="main" className={page.main}>
      <section className={styles.opening} aria-labelledby="room-title">
        <div className={styles.stage} role="img" aria-label={pieceAlt}>
          <RoomStage piece={piece} className={styles.fill} />
        </div>
        <div className={`${page.wrap} ${styles.words}`}>
          <h1 id="room-title" className={page.title}>{heading}</h1>
          <p className={page.lede}>{sub}</p>
        </div>
      </section>
      <div className={page.wrap}>
        {note ? <p className={`${page.note} ${styles.note}`}>{note}</p> : null}
        {children}
      </div>
    </main>
  );
}

import { site } from '../content/site';
import { Picture } from './Picture';
import styles from './Letter.module.css';

// About: the portrait and a short signed letter.
export function Letter({ headingLevel = 2, headingId }: { headingLevel?: 1 | 2; headingId?: string }) {
  const H = headingLevel === 1 ? 'h1' : 'h2';
  const a = site.about;
  return (
    <div className={styles.about}>
      <figure className={styles.portrait}>
        <Picture media={a.portrait} sizes="(max-width: 820px) 80vw, 30vw" className={styles.photo} />
      </figure>
      <div className={styles.letter}>
        <H className={styles.heading} id={headingId}>{a.heading}</H>
        <div className={styles.body}>
          {a.letter.map((p) => <p key={p}>{p}</p>)}
        </div>
        <p className={styles.signature}>{a.signature}</p>
      </div>
    </div>
  );
}

import { BREAKPOINT_ONE_COLUMN } from '../config/site';
import { site } from '../content/site';
import { MEDIA } from '../content/media.generated';
import { Picture } from './Picture';
import { Plate } from './Plate';
import styles from './Letter.module.css';

// About: the portrait in an aged brass frame lit by the lamp, under glass, and a short signed letter.
const largest = (id: keyof typeof MEDIA) => MEDIA[id].srcs[MEDIA[id].srcs.length - 1].src;

export function Letter({ headingLevel = 2, headingId }: { headingLevel?: 1 | 2; headingId?: string }) {
  const H = headingLevel === 1 ? 'h1' : 'h2';
  const a = site.about;
  return (
    <div className={styles.about}>
      {/* The water bends behind the portrait: it runs down the frame's centre line, hidden by the plate, and comes out below. */}
      <figure className={styles.portrait} id={`${headingId ?? 'about'}-portrait`} data-water="weave" data-water-above={BREAKPOINT_ONE_COLUMN} data-water-line={`#${headingId ?? 'about'}-portrait`}>
        <Plate finish="aged" kind="frame" label={a.signature} photo={{ src: largest(a.portrait.id), focus: [0.5, 0.32] }} className={styles.frame}>
          <Picture media={a.portrait} sizes="(max-width: 820px) 80vw, 30vw" className={styles.photo} />
        </Plate>
      </figure>
      <div className={styles.letter} data-water-avoid="">
        <H className={styles.heading} id={headingId}>{a.heading}</H>
        <div className={styles.body}>
          {a.letter.map((p) => <p key={p}>{p}</p>)}
        </div>
        <p className={styles.signature}>{a.signature}</p>
      </div>
    </div>
  );
}

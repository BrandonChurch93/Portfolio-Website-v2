import Link from 'next/link';
import { ROUTES } from '../config/site';
import { MEDIA } from '../content/media.generated';
import type { Finish, Project } from '../content/site';
import { Plate } from './Plate';
import styles from './ProjectPlate.module.css';

const largest = (id: keyof typeof MEDIA) => MEDIA[id].srcs[MEDIA[id].srcs.length - 1].src;

// One project on a lit plate: the name small, the reason large, the facts small along the bottom edge, and a photo
// window when the project has a picture. The words are painted into the metal and kept in the DOM for readers.
export function ProjectPlate({ project, index, finish = 'aged', headingLevel = 3, water, waterLine, waterBelow }: { project: Project; index: number; finish?: Finish; headingLevel?: 2 | 3; water?: 'left' | 'right'; waterLine?: string; waterBelow?: number }) {
  const H = headingLevel === 2 ? 'h2' : 'h3';
  const media = project.media[0];
  const label = `${String(index + 1).padStart(2, '0')} · ${project.name.toUpperCase()}`;
  const facts = project.facts.map((f) => f.toUpperCase()).join(' · ');
  return (
    <article
      className={styles.plate}
      data-window={media ? 'yes' : 'no'}
      data-water-avoid=""
      {...(water ? { 'data-water': 'weave', 'data-water-side': water, 'data-water-id': `work-${project.slug}` } : {})}
      {...(water && waterLine ? { 'data-water-line': waterLine } : {})}
      {...(water && waterBelow ? { 'data-water-below': String(waterBelow) } : {})}
    >
      <Link href={ROUTES.project(project.slug)} className={styles.link}>
        <Plate finish={finish} label={label} big={project.why} facts={facts} photo={media ? { src: largest(media.id) } : undefined} className={styles.metal}>
          <span className={styles.index}>{String(index + 1).padStart(2, '0')} · </span>
          <H>{project.name}</H>
          <p>{project.why}</p>
          <ul>{project.facts.map((f) => <li key={f}>{f}</li>)}</ul>
          {media ? <span>{media.alt}</span> : null}
        </Plate>
      </Link>
    </article>
  );
}

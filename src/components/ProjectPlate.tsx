import Link from 'next/link';
import { ROUTES } from '../config/site';
import type { Project } from '../content/site';
import { Picture } from './Picture';
import styles from './ProjectPlate.module.css';

// One project: the name small, the reason large, the facts small along the bottom, and a photo window when the
// project has a picture. Phase 2 lights this as metal; the words stay in the DOM either way.
export function ProjectPlate({ project, index, headingLevel = 3 }: { project: Project; index: number; headingLevel?: 2 | 3 }) {
  const H = headingLevel === 2 ? 'h2' : 'h3';
  const media = project.media[0];
  return (
    <article className={styles.plate} data-window={media ? 'yes' : 'no'}>
      <Link href={ROUTES.project(project.slug)} className={styles.link}>
        <div className={styles.words}>
          <div className={styles.label}>
            <span aria-hidden="true">{String(index + 1).padStart(2, '0')} · </span>
            <H className={styles.name}>{project.name}</H>
          </div>
          <p className={styles.why}>{project.why}</p>
          <ul className={styles.facts}>
            {project.facts.map((f) => <li key={f}>{f}</li>)}
          </ul>
        </div>
        {media ? (
          <div className={styles.window}>
            <Picture media={media} sizes="(max-width: 820px) 90vw, 40vw" className={styles.photo} />
          </div>
        ) : null}
      </Link>
    </article>
  );
}

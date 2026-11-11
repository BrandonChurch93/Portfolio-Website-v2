import type { Metadata } from 'next';
import { site } from '../../content/site';
import { MetalLink } from '../../components/MetalLink';
import page from '../../components/Page.module.css';
import styles from './resume.module.css';

// A line of parts joined by interpuncts wraps between parts, never inside one.
const kept = (line: string) => line.split(' · ').map((part, i) => (
  <span key={part}>{i ? ' · ' : ''}<span className={styles.keep}>{part}</span></span>
));

export const metadata: Metadata = { title: site.meta.resume.title, description: site.meta.resume.description };

export default function Resume() {
  const r = site.resume;
  return (
    <main id="main" className={page.main}>
      <article className={`${page.wrap} ${styles.sheet}`}>
        <header className={styles.head}>
          <p className={page.eyebrow}>{r.heading}</p>
          <h1 className={page.title}>{r.name}</h1>
          <p className={styles.titles}>{kept(r.titles)}</p>
          <p className={styles.place}>{kept(r.place)}</p>
          <MetalLink href={r.file} label={site.ui.resumeDownload} finish="aged" download />
        </header>
        <p className={styles.summary}>{r.summary}</p>

        <section aria-labelledby="experience" className={styles.section}>
          <h2 id="experience" className={styles.h2}>{r.experienceHeading}</h2>
          <ol className={styles.roles}>
            {r.roles.map((role) => (
              <li key={`${role.org}-${role.when}`} className={styles.role}>
                <div className={styles.roleHead}>
                  <h3 className={styles.roleTitle}>{role.title} <span className={styles.org}>· {role.org}</span></h3>
                  <p className={styles.when}>{role.when}{role.where ? ` · ${role.where}` : ''}</p>
                </div>
                {role.summary ? <p className={styles.roleSummary}>{role.summary}</p> : null}
                <ul className={styles.points}>
                  {role.points.map((pt) => <li key={pt}>{pt}</li>)}
                </ul>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="earlier" className={styles.section}>
          <h2 id="earlier" className={styles.h2}>{r.earlierHeading}</h2>
          <ul className={styles.earlier}>
            {r.earlier.map((e) => (
              <li key={e.org}><span className={styles.roleTitle}>{e.title} <span className={styles.org}>· {e.org}</span></span><span className={styles.when}>{e.when}</span></li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="skills" className={styles.section}>
          <h2 id="skills" className={styles.h2}>{r.skillsHeading}</h2>
          <dl className={styles.skills}>
            {r.skills.map((s) => (
              <div key={s.name}><dt>{s.name}</dt><dd>{s.items}</dd></div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="education" className={styles.section}>
          <h2 id="education" className={styles.h2}>{r.educationHeading}</h2>
          <p>{r.education}</p>
        </section>
      </article>
    </main>
  );
}

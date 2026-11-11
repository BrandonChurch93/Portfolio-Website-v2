import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ROUTES } from '../../../config/site';
import { projectBySlug, projects, site } from '../../../content/site';
import { ExternalLink } from '../../../components/ExternalLink';
import { Picture } from '../../../components/Picture';
import page from '../../../components/Page.module.css';
import styles from './project.module.css';

export const dynamicParams = false;

export function generateStaticParams() {
  return projects.map((p) => ({ slug: p.slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = projectBySlug((await params).slug);
  return p ? { title: p.name, description: p.why } : {};
}

export default async function ProjectPage({ params }: Props) {
  const { slug } = await params;
  const p = projectBySlug(slug);
  if (!p) notFound();
  const i = projects.indexOf(p);
  const prev = projects[i - 1];
  const next = projects[i + 1];
  const media = p.media[0];
  return (
    <main id="main" className={page.main}>
      <article className={page.wrap}>
        <header className={styles.head}>
          <p className={page.eyebrow}>
            <Link href={ROUTES.work} className={styles.back}>{site.ui.allWork}</Link>
          </p>
          <h1 className={page.title}>{p.name}</h1>
          <ul className={styles.facts}>
            {p.facts.map((f) => <li key={f}>{f}</li>)}
          </ul>
        </header>
        {media ? (
          <figure className={styles.window}>
            <Picture media={media} sizes="(max-width: 820px) 94vw, 80vw" priority className={styles.photo} />
          </figure>
        ) : null}
        <div className={styles.grid}>
          <section className={styles.why} aria-labelledby="why">
            <h2 id="why" className={styles.label}>{site.ui.projectWhy}</h2>
            <p className={styles.reason}>{p.why}</p>
          </section>
          <div className={styles.body}>
            {p.body.map((b) => <p key={b}>{b}</p>)}
          </div>
          <aside className={styles.side}>
            {p.stack.length ? (
              <section aria-labelledby="stack">
                <h2 id="stack" className={styles.label}>{site.ui.projectStack}</h2>
                <ul className={styles.stack}>
                  {p.stack.map((s) => <li key={s}>{s}</li>)}
                </ul>
              </section>
            ) : null}
            <section aria-labelledby="links">
              <h2 id="links" className={styles.label}>{site.ui.projectLinks}</h2>
              {p.links.length ? (
                <ul className={styles.links}>
                  {p.links.map((l) => <li key={l.href}><ExternalLink href={l.href} className={styles.link}>{l.label}</ExternalLink></li>)}
                </ul>
              ) : (
                <p className={styles.none}>{site.ui.projectNoLinks}</p>
              )}
            </section>
          </aside>
        </div>
        <nav className={styles.pager} aria-label={site.ui.allWork}>
          {prev ? <Link href={ROUTES.project(prev.slug)} className={styles.pagerLink} data-dir="prev"><span>{site.ui.prevProject}</span>{prev.name}</Link> : <span />}
          {next ? <Link href={ROUTES.project(next.slug)} className={styles.pagerLink} data-dir="next"><span>{site.ui.nextProject}</span>{next.name}</Link> : <span />}
        </nav>
      </article>
    </main>
  );
}

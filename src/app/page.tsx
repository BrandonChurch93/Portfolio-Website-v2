import { ROUTES } from '../config/site';
import { projectBySlug, site, type Project } from '../content/site';
import { ContactLinks } from '../components/ContactLinks';
import { Doors } from '../components/Doors';
import { Ledger } from '../components/Ledger';
import { Letter } from '../components/Letter';
import { MetalLink } from '../components/MetalLink';
import { Placards } from '../components/Placards';
import { ProjectPlate } from '../components/ProjectPlate';
import page from '../components/Page.module.css';
import styles from './home.module.css';

const featured = site.work.featured.map((s) => projectBySlug(s)).filter((p): p is Project => !!p);

export default function Home() {
  return (
    <main id="main" className={page.main}>
      <section id="hero" className={styles.hero} aria-labelledby="hero-title">
        <div className={styles.stage} aria-hidden="true" />
        <div className={`${page.wrap} ${styles.heroWords}`}>
          <h1 id="hero-title" className={styles.headline}>{site.hero.headline}</h1>
          <p className={styles.heroSub}>{site.hero.sub}</p>
          <a href="#work" className={styles.cue}>{site.hero.cue}</a>
        </div>
      </section>

      <section id="work" className={page.section} aria-labelledby="work-title">
        <div className={page.wrap}>
          <header className={page.sectionHead}>
            <h2 id="work-title" className={page.h2}>{site.work.heading}</h2>
            <p className={page.sub}>{site.work.sub}</p>
          </header>
          <div className={styles.featured}>
            {featured.map((p, i) => (
              <div key={p.slug} className={styles.featuredRow} data-side={i % 2 ? 'right' : 'left'}>
                <ProjectPlate project={p} index={i} />
              </div>
            ))}
          </div>
          <MetalLink href={ROUTES.work} label={site.work.link} />
        </div>
      </section>

      <section id="clients" className={page.section} aria-labelledby="clients-title">
        <div className={page.wrap}>
          <Placards items={site.clients.items} bar={site.clients.bar} sub={site.clients.sub} headingId="clients-title" />
        </div>
      </section>

      <section id="skills" className={page.section} aria-labelledby="skills-title">
        <div className={page.wrap}>
          <header className={`${page.sectionHead} ${styles.centered}`}>
            <h2 id="skills-title" className={page.h2}>{site.skills.heading}</h2>
            <p className={page.sub}>{site.skills.sub}</p>
          </header>
          <div className={styles.desk} role="img" aria-label={site.skills.deskAlt} />
          <Ledger areas={site.skills.areas} />
        </div>
      </section>

      <section id="rooms" className={page.section} aria-labelledby="rooms-title">
        <div className={page.wrap}>
          <header className={page.sectionHead}>
            <h2 id="rooms-title" className={page.h2}>{site.rooms.heading}</h2>
          </header>
          <Doors doors={site.rooms.doors} />
        </div>
      </section>

      <section id="about" className={page.section} aria-labelledby="about-title">
        <div className={page.wrap}>
          <Letter headingId="about-title" />
        </div>
      </section>

      <section id="contact" className={page.section} aria-labelledby="contact-title">
        <div className={page.wrap}>
          <header className={page.sectionHead}>
            <h2 id="contact-title" className={page.h2}>{site.contact.heading}</h2>
            <p className={page.sub}>{site.contact.line}</p>
          </header>
          <ContactLinks />
          <div className={styles.pad} aria-hidden="true" />
        </div>
      </section>
    </main>
  );
}

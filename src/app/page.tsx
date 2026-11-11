import { site } from '../content/site';
import { About } from '../components/About';
import { ContactLinks } from '../components/ContactLinks';
import { Hero } from '../components/Hero';
import { Launchpad } from '../components/Launchpad';
import { Ledger } from '../components/Ledger';
import { Workbench } from '../components/Workbench';
import { WorkWall } from '../components/WorkWall';
import page from '../components/Page.module.css';
import styles from './home.module.css';

// The home page, in the order the water runs it: the city, the work, the desk and the skills, the portrait, the pool.
export default function Home() {
  return (
    <main id="main" className={page.main}>
      <Hero />

      <section id="work" className={styles.work} aria-labelledby="work-title">
        <div className={page.wrap} data-water-column="">
          <WorkWall />
        </div>
      </section>

      <section id="skills" className={page.section} aria-labelledby="skills-title">
        <div className={page.wrap}>
          <header className={`${page.sectionHead} ${styles.centered}`} data-water-avoid="">
            <h2 id="skills-title" className={page.h2}>{site.skills.heading}</h2>
            <p className={page.sub}>{site.skills.sub}</p>
          </header>
          <Workbench />
          <Ledger areas={site.skills.areas} />
        </div>
      </section>

      <section id="about" className={page.section} aria-labelledby="about-title">
        <div className={page.wrap}>
          <About headingId="about-title" />
        </div>
      </section>

      <section id="contact" className={page.section} aria-labelledby="contact-title">
        <div className={page.wrap}>
          <Launchpad>
            <header className={page.sectionHead} data-water-avoid="">
              <h2 id="contact-title" className={page.h2}>{site.contact.heading}</h2>
              <p className={page.sub}>{site.contact.line}</p>
            </header>
            <ContactLinks />
          </Launchpad>
        </div>
      </section>
    </main>
  );
}

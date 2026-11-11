import type { Metadata } from 'next';
import { site } from '../../../content/site';
import page from '../../../components/Page.module.css';

// Exists only while SHOW_LAB is on. Phase 3 builds the water here.
export const metadata: Metadata = { title: `${site.meta.lab.title} · ${site.lab.water}`, description: site.meta.lab.description, robots: { index: false } };

export default function LabWater() {
  return (
    <main id="main" className={page.main}>
      <div className={page.wrap}>
        <header className={page.head}>
          <h1 className={page.title}>{site.lab.water}</h1>
        </header>
      </div>
    </main>
  );
}

import type { Metadata } from 'next';
import { site } from '../../content/site';
import { Letter } from '../../components/Letter';
import page from '../../components/Page.module.css';
import styles from './about.module.css';

export const metadata: Metadata = { title: site.meta.about.title, description: site.meta.about.description };

export default function About() {
  return (
    <main id="main" className={page.main}>
      <div className={`${page.wrap} ${styles.wrap}`}>
        <Letter headingLevel={1} />
      </div>
    </main>
  );
}

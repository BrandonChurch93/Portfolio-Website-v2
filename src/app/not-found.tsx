import type { Metadata } from 'next';
import { ROUTES } from '../config/site';
import { site } from '../content/site';
import { MetalLink } from '../components/MetalLink';
import page from '../components/Page.module.css';
import styles from './notfound.module.css';

export const metadata: Metadata = { title: site.meta.notFound.title, description: site.meta.notFound.description };

export default function NotFound() {
  return (
    <main id="main" className={page.main}>
      <div className={`${page.wrap} ${styles.wrap}`}>
        <div className={styles.words} data-water-avoid="">
          <h1 className={styles.line}>{site.notFound.line}</h1>
          <MetalLink href={ROUTES.home} label={site.notFound.back} />
        </div>
        {/* The page's one interaction: the stream comes in from the top, goes round the words and pools here. */}
        <div className={styles.pool} data-water="pool" data-water-id="lost" aria-hidden="true" />
      </div>
    </main>
  );
}

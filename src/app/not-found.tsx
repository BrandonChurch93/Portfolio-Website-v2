import type { Metadata } from 'next';
import Link from 'next/link';
import { ROUTES } from '../config/site';
import { site } from '../content/site';
import page from '../components/Page.module.css';
import styles from './notfound.module.css';

export const metadata: Metadata = { title: site.meta.notFound.title, description: site.meta.notFound.description };

export default function NotFound() {
  return (
    <main id="main" className={page.main}>
      <div className={`${page.wrap} ${styles.wrap}`}>
        <div className={styles.stage} aria-hidden="true" />
        <h1 className={styles.line}>{site.notFound.line}</h1>
        <Link href={ROUTES.home} className={page.more}>{site.notFound.back}</Link>
      </div>
    </main>
  );
}

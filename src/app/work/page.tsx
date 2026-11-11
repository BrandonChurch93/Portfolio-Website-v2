import type { Metadata } from 'next';
import { projects, site } from '../../content/site';
import { PageHead } from '../../components/PageHead';
import { ProjectPlate } from '../../components/ProjectPlate';
import page from '../../components/Page.module.css';
import styles from './work.module.css';

export const metadata: Metadata = { title: site.meta.work.title, description: site.meta.work.description };

export default function Work() {
  return (
    <main id="main" className={page.main}>
      <div className={page.wrap}>
        <PageHead title={site.work.pageHeading} lede={site.work.pageSub} />
        <div className={styles.list}>
          {projects.map((p, i) => <ProjectPlate key={p.slug} project={p} index={i} headingLevel={2} />)}
        </div>
      </div>
    </main>
  );
}

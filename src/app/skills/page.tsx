import type { Metadata } from 'next';
import { site } from '../../content/site';
import { Ledger } from '../../components/Ledger';
import { PageHead } from '../../components/PageHead';
import { Workbench } from '../../components/Workbench';
import page from '../../components/Page.module.css';

export const metadata: Metadata = { title: site.meta.skills.title, description: site.meta.skills.description };

export default function Skills() {
  return (
    <main id="main" className={page.main}>
      <div className={page.wrap}>
        <PageHead title={site.skills.heading} lede={site.skills.sub} />
        <Workbench />
        <Ledger areas={site.skills.areas} level={2} />
      </div>
    </main>
  );
}

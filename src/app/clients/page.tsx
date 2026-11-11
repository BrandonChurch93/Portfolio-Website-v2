import type { Metadata } from 'next';
import { site } from '../../content/site';
import { PageHead } from '../../components/PageHead';
import { Placards } from '../../components/Placards';
import page from '../../components/Page.module.css';

export const metadata: Metadata = { title: site.meta.clients.title, description: site.meta.clients.description };

export default function Clients() {
  return (
    <main id="main" className={page.main}>
      <div className={page.wrap}>
        <PageHead title={site.meta.clients.title} lede={site.clients.pageSub} />
        <Placards items={site.clients.items} bar={site.clients.bar} />
      </div>
    </main>
  );
}

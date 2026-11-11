import type { Metadata } from 'next';
import { site } from '../../../content/site';
import { MetalLab } from '../../../components/lab/MetalLab';
import page from '../../../components/Page.module.css';

// Exists only while SHOW_LAB is on. The plate renderer, one specimen per screen.
export const metadata: Metadata = { title: `${site.meta.lab.title} · ${site.lab.metal}`, description: site.meta.lab.description, robots: { index: false } };

export default function LabMetal() {
  return (
    <main id="main" className={page.main}>
      <div className={page.wrap}>
        <h1 className="visually-hidden">{site.lab.metal}</h1>
        <MetalLab />
      </div>
    </main>
  );
}

import type { Metadata } from 'next';
import { PIECES } from '../../../../config/site';
import { site } from '../../../../content/site';
import page from '../../../../components/Page.module.css';

// Exists only while SHOW_LAB is on. Each piece is built and shot alone here.
export const dynamicParams = false;

export function generateStaticParams() {
  return PIECES.map((name) => ({ name }));
}

export const metadata: Metadata = { title: `${site.meta.lab.title} · ${site.lab.piece}`, description: site.meta.lab.description, robots: { index: false } };

export default async function LabPiece({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  return (
    <main id="main" className={page.main}>
      <div className={page.wrap}>
        <header className={page.head}>
          <h1 className={page.title}>{site.lab.piece} · {name}</h1>
        </header>
      </div>
    </main>
  );
}

import type { Metadata } from 'next';
import { PIECES } from '../../../../config/site';
import { site } from '../../../../content/site';
import { PieceView } from '../../../../components/PieceView';
import styles from '../../../../components/lab/PieceLab.module.css';

// Exists only while SHOW_LAB is on. Each piece is built and shot alone here, at rest, filling the viewport.
export const dynamicParams = false;

export function generateStaticParams() {
  return PIECES.map((name) => ({ name }));
}

export const metadata: Metadata = { title: `${site.meta.lab.title} · ${site.lab.piece}`, description: site.meta.lab.description, robots: { index: false } };

export default async function LabPiece({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  return (
    <main id="main" className={styles.main} data-water-off="">
      <h1 className={styles.title}>{site.lab.piece} · {name}</h1>
      <PieceView name={name} className={styles.stage} switchSide={name === 'workbench' ? 'left' : 'right'} />
    </main>
  );
}

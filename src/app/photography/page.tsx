import type { Metadata } from 'next';
import { site } from '../../content/site';
import { Room } from '../../components/Room';

export const metadata: Metadata = { title: site.meta.photography.title, description: site.meta.photography.description };

export default function Photography() {
  const p = site.photography;
  return <Room heading={p.heading} sub={p.sub} note={p.note} pieceAlt={p.pieceAlt} piece="camera" />;
}

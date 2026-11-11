import type { Metadata } from 'next';
import { site } from '../../content/site';
import { Room } from '../../components/Room';

// Exists only while SHOW_3D_ART is on: the art.tsx page extension is added by next.config.ts.
export const metadata: Metadata = { title: site.meta.art3d.title, description: site.meta.art3d.description };

export default function Art3d() {
  const a = site.art3d;
  return <Room heading={a.heading} sub={a.sub} note={a.note} pieceAlt={a.pieceAlt} piece="sculpture" />;
}

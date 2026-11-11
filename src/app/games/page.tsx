import type { Metadata } from 'next';
import { site } from '../../content/site';
import { Room } from '../../components/Room';

export const metadata: Metadata = { title: site.meta.games.title, description: site.meta.games.description };

export default function Games() {
  const g = site.games;
  return <Room heading={g.heading} sub={g.sub} note={g.note} pieceAlt={g.pieceAlt} piece="handheld" />;
}

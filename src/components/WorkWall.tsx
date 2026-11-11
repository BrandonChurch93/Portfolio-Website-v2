'use client';

import { useId, useMemo, useState } from 'react';
import { ROUTES, SHOW_3D_ART } from '../config/site';
import { projectBySlug, site, type Project, type WorkCategory } from '../content/site';
import { DoorViews } from './DoorViews';
import { MetalButton, onTabKeys } from './MetalButton';
import { MetalLink } from './MetalLink';
import { Picture } from './Picture';
import { Plate } from './Plate';
import { SiteLink } from './SiteLink';
import styles from './WorkWall.module.css';

type CategoryId = WorkCategory['id'];
type RoomId = Exclude<CategoryId, 'software'>;

const wall = site.work.wall.map((s) => projectBySlug(s)).filter((p): p is Project => !!p);
const categories = site.work.categories.filter((c) => c.id !== 'art3d' || SHOW_3D_ART);
const rooms: Record<RoomId, { sub: string; note: string; pieceAlt: string }> = { games: site.games, art3d: site.art3d, photography: site.photography };

function Card({ project }: { project: Project }) {
  const media = project.media[0];
  return (
    <li className={styles.item}>
      <SiteLink href={ROUTES.project(project.slug)} className={styles.card}>
        <div className={styles.window}>
          {media ? (
            <Picture media={media} sizes="(max-width: 640px) 90vw, (max-width: 1100px) 45vw, 30vw" className={styles.picture} style={media.focus ? { objectPosition: `${media.focus[0] * 100}% ${media.focus[1] * 100}%` } : undefined} />
          ) : (
            <div className={styles.cover}>
              <span className={styles.coverName} aria-hidden="true">{project.name}</span>
              <span className={styles.coverNote}>{site.work.pictureToCome}</span>
            </div>
          )}
        </div>
        <div className={styles.body}>
          <h3 className={styles.name}>{project.name}</h3>
          <p className={styles.why}>{project.why}</p>
          <ul className={styles.tags}>{project.facts.map((f) => <li key={f} className={styles.tag}>{f}</li>)}</ul>
        </div>
      </SiteLink>
    </li>
  );
}

// A kind of work with nothing to show yet: its piece, live, and its line.
function RoomTile({ id, name }: { id: RoomId; name: string }) {
  const r = rooms[id];
  const one = useMemo(() => [id], [id]);
  return (
    <li className={styles.room} data-doors="">
      <div className={styles.roomView} data-room={id} role="img" aria-label={r.pieceAlt} />
      <div className={styles.roomWords}>
        <h3 className={styles.name}>{name}</h3>
        <p className={styles.why}>{r.sub}</p>
        <p className={styles.roomNote}>{r.note}</p>
      </div>
      <DoorViews rooms={one} />
    </li>
  );
}

// All the work in one section. The title is engraved on a brass lintel set in from the cards: the city's water lands on
// its middle, runs both ways, pours onto the top corners of the outer cards, clings down the sides of the wall and
// meets behind the link under it. One kind of work shows at a time.
export function WorkWall() {
  const [cat, setCat] = useState<CategoryId>(categories[0].id);
  const base = useId();
  const current = categories.find((c) => c.id === cat) ?? categories[0];
  return (
    <div className={styles.wall}>
      <div className={styles.lintelWrap} data-water="split" data-water-id="work" data-water-frame="#work-grid" data-water-join="#work-more">
        <Plate finish="polished" kind="bar" label={site.work.heading.toUpperCase()} className={styles.lintel}>
          <h2 id="work-title">{site.work.heading}</h2>
        </Plate>
      </div>
      <p className={styles.sub} data-water-avoid="">{site.work.sub}</p>
      <div role="tablist" aria-label={site.work.categoriesLabel} className={styles.cats} onKeyDown={onTabKeys}>
        {categories.map((c) => (
          <MetalButton key={c.id} id={`${base}-${c.id}`} controls={`${base}-panel`} label={c.name} selected={c.id === current.id} onSelect={() => setCat(c.id)} />
        ))}
      </div>
      <div role="tabpanel" id={`${base}-panel`} aria-labelledby={`${base}-${current.id}`}>
        <ul id="work-grid" className={styles.grid} data-kind={current.id}>
          {current.id === 'software'
            ? wall.map((p) => <Card key={p.slug} project={p} />)
            : <RoomTile key={current.id} id={current.id} name={current.name} />}
        </ul>
      </div>
      <div className={styles.more}>
        <span id="work-more" className={styles.moreBox}>
          <MetalLink href={ROUTES.work} label={site.work.link} className={styles.moreLink} />
        </span>
      </div>
    </div>
  );
}

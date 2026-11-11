'use client';

import { SiteLink } from './SiteLink';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useState } from 'react';
import { ROUTES, SHOW_3D_ART, SITE_NAME } from '../config/site';
import { site } from '../content/site';
import styles from './Nav.module.css';

const ITEMS = [
  { href: ROUTES.work, label: site.ui.nav.work },
  { href: ROUTES.clients, label: site.ui.nav.clients },
  { href: ROUTES.skills, label: site.ui.nav.skills },
  { href: ROUTES.games, label: site.ui.nav.games },
  { href: ROUTES.photography, label: site.ui.nav.photography },
  ...(SHOW_3D_ART ? [{ href: ROUTES.art3d, label: site.ui.nav.art3d }] : []),
  { href: ROUTES.about, label: site.ui.nav.about },
  { href: ROUTES.resume, label: site.ui.nav.resume },
];

export function Nav() {
  const path = usePathname() ?? '/';
  const [open, setOpen] = useState(false);
  const menuId = useId();

  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    addEventListener('keydown', onKey);
    document.documentElement.dataset.menu = 'open';
    return () => { removeEventListener('keydown', onKey); delete document.documentElement.dataset.menu; };
  }, [open]);

  const current = (href: string) => (href === '/' ? path === '/' : path.startsWith(href.replace(/\/$/, '')));

  return (
    <header className={styles.bar}>
      <a className={styles.skip} href="#main">{site.ui.skip}</a>
      <div className={styles.inner}>
        <SiteLink href={ROUTES.home} className={styles.name} aria-label={`${SITE_NAME}, ${site.ui.home}`}>
          {SITE_NAME}
        </SiteLink>
        <button
          type="button"
          className={styles.toggle}
          aria-expanded={open}
          aria-controls={menuId}
          onClick={() => setOpen((o) => !o)}
        >
          <span className={styles.toggleText}>{open ? site.ui.menuClose : site.ui.menuOpen}</span>
          <span className={styles.toggleMark} aria-hidden="true" data-open={open} />
        </button>
        <nav aria-label={site.ui.navLabel} id={menuId} className={styles.nav} data-open={open}>
          <ul className={styles.list}>
            {ITEMS.map((it) => (
              <li key={it.href}>
                <SiteLink href={it.href} className={styles.link} aria-current={current(it.href) ? 'page' : undefined}>
                  {it.label}
                </SiteLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}

'use client';

import Link from 'next/link';
import type { Finish } from '../content/site';
import { Plate } from './Plate';
import styles from './MetalLink.module.css';

// A primary action as a small lit brass plate. Its words are engraved in the metal and kept in the DOM as the link text.
export function MetalLink({ href, label, finish = 'polished', download, className }: { href: string; label: string; finish?: Finish; download?: boolean; className?: string }) {
  const inner = <Plate finish={finish} kind="control" label={label} className={styles.plate}>{label}</Plate>;
  if (download || /^(https?:|mailto:)/.test(href)) {
    return <a href={href} className={`${styles.link} ${className ?? ''}`} download={download || undefined}>{inner}</a>;
  }
  return <Link href={href} className={`${styles.link} ${className ?? ''}`}>{inner}</Link>;
}

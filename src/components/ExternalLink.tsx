import type { ReactNode } from 'react';
import { site } from '../content/site';

// A link that leaves the site opens in a new tab and says so to screen readers. mailto: stays in place.
export function ExternalLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  const leaves = /^https?:/.test(href);
  return (
    <a href={href} className={className} {...(leaves ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
      {children}
      {leaves ? <span className="visually-hidden"> ({site.ui.externalHint})</span> : null}
    </a>
  );
}

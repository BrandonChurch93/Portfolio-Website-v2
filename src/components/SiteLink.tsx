'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ComponentProps } from 'react';

// Fetches the next page when the visitor shows intent (pointer, focus, touch), not whenever a link scrolls into view:
// a page prefetched in passing carries preloads for its pictures and styles that then go unused.
export function SiteLink({ href, ...rest }: Omit<ComponentProps<typeof Link>, 'href' | 'prefetch'> & { href: string }) {
  const router = useRouter();
  const warm = () => router.prefetch(href);
  return <Link {...rest} href={href} prefetch={false} onPointerEnter={warm} onFocus={warm} onTouchStart={warm} />;
}

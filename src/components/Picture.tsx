import type { CSSProperties } from 'react';
import type { MediaRef } from '../content/site';
import { MEDIA } from '../content/media.generated';

// A processed picture with its real size, so layout never jumps. sizes says how wide it shows.
export function Picture({ media, sizes, className, priority = false, style }: { media: MediaRef; sizes: string; className?: string; priority?: boolean; style?: CSSProperties }) {
  const m = MEDIA[media.id];
  const largest = m.srcs[m.srcs.length - 1];
  return (
    <img
      src={largest.src}
      srcSet={m.srcs.map((s) => `${s.src} ${s.w}w`).join(', ')}
      sizes={sizes}
      width={m.w}
      height={m.h}
      alt={media.alt}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      className={className}
      style={{ backgroundColor: m.tone, ...style }}
    />
  );
}

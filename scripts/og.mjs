// The image shown when a link to the site is shared: the city settled at rest, from the hero's own still, cropped to
// 1200 by 630, and one per project picture. Run after scripts/stills.mjs whenever the city changes: node scripts/og.mjs
import sharp from 'sharp';

const SRC = 'public/generated/city-rest-wide.webp';
const OUT = 'public/generated/og.jpg';
const W = 1200, H = 630;

const meta = await sharp(SRC).metadata();
const cropH = Math.round((meta.width * H) / W);
const top = Math.max(0, Math.round((meta.height - cropH) * 0.55));
await sharp(SRC).extract({ left: 0, top, width: meta.width, height: Math.min(cropH, meta.height - top) }).resize(W, H, { fit: 'cover' }).jpeg({ quality: 86, mozjpeg: true }).toFile(OUT);
console.log(`og: ${OUT} · ${W}x${H}`);

// One per project picture, cut around the same focus its windows use, so a shared project link shows its own work.
const { site } = await import('../src/content/site.ts');
const { MEDIA } = await import('../src/content/media.generated.ts');
for (const p of site.work.projects) {
  const m = p.media[0];
  if (!m) continue;
  const src = `public${MEDIA[m.id].srcs[MEDIA[m.id].srcs.length - 1].src}`;
  const [fx, fy] = m.focus ?? [0.5, 0.3];
  const info = await sharp(src).metadata();
  const scale = Math.max(W / info.width, H / info.height);
  const w = Math.round(W / scale), h = Math.round(H / scale);
  const left = Math.round(Math.min(info.width - w, Math.max(0, fx * info.width - w / 2)));
  const top = Math.round(Math.min(info.height - h, Math.max(0, fy * info.height - h / 2)));
  const out = `public/generated/og-${m.id}.jpg`;
  await sharp(src).extract({ left, top, width: w, height: h }).resize(W, H).jpeg({ quality: 86, mozjpeg: true }).toFile(out);
  console.log(`og: ${out}`);
}

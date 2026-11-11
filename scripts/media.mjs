// The picture pipeline.
//
//   node scripts/media.mjs
//
// Reads the sources below (from old-site/ or incoming/), writes sized WebP files to public/media/, copies files that
// are used as they are (the résumé PDF, video), and writes src/content/media.generated.ts: every picture's real width
// and height and its sizes, so layout never jumps. Only pictures that were opened and judged are listed here, and each
// is logged under "Pictures used" in kit/PROGRESS.md.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { MEDIA_WIDTHS } from '../src/config/site.ts';

const OUT = 'public/media';
const LIST = 'src/content/media.generated.ts';

// crop: fractions of the source { left, top, width, height }.
const PICTURES = [
  { id: 'dse', from: 'old-site/public/images/design-system-extractor.png' },
  { id: 'claude-docs', from: 'old-site/public/images/the-claude-docs.png', crop: { left: 0, top: 0, width: 1, height: 0.655 } },
  { id: 'glasses', from: 'old-site/public/images/proactive-ui-for-ai-glasses.jpg' },
  { id: 'genui', from: 'old-site/public/images/genui-github.png' },
  { id: 'meridian', from: 'old-site/public/images/Meridian-Project.png' },
  { id: 'animation-builder', from: 'old-site/public/images/animation-builder.png', crop: { left: 0.045, top: 0, width: 0.955, height: 0.925 } },
  { id: 'modern-softworks', from: 'old-site/public/images/ModernSoftworks.png' },
  { id: 'portrait', from: 'old-site/public/images/headshot2.jpg' },
];

const FILES = [
  { from: 'old-site/public/downloads/BrandonChurch-Resume.pdf', to: 'brandon-church-resume.pdf' },
];

fs.mkdirSync(OUT, { recursive: true });
const list = {};
for (const p of PICTURES) {
  if (!fs.existsSync(p.from)) { console.error(`media: missing ${p.from}. Run node scripts/import-old-site.mjs first.`); process.exit(1); }
  const meta = await sharp(p.from).metadata();
  let img = sharp(p.from).rotate();
  let w = meta.width; let h = meta.height;
  if (p.crop) {
    const area = { left: Math.round(p.crop.left * w), top: Math.round(p.crop.top * h), width: Math.round(p.crop.width * w), height: Math.round(p.crop.height * h) };
    img = img.extract(area);
    w = area.width; h = area.height;
  }
  const base = await img.toBuffer();
  const widths = [...new Set(MEDIA_WIDTHS.filter((x) => x < w).concat(Math.min(w, MEDIA_WIDTHS[MEDIA_WIDTHS.length - 1])))].sort((a, b) => a - b);
  const srcs = [];
  for (const width of widths) {
    const file = `${p.id}-${width}.webp`;
    const out = path.join(OUT, file);
    const info = await sharp(base).resize({ width, withoutEnlargement: true }).webp({ quality: 84, effort: 6, smartSubsample: true }).toFile(out);
    srcs.push({ w: info.width, h: info.height, src: `/media/${file}` });
  }
  const { dominant } = await sharp(base).stats();
  const tone = `rgb(${dominant.r}, ${dominant.g}, ${dominant.b})`;
  list[p.id] = { w, h, tone, srcs };
  console.log(`media: ${p.id} ${w}x${h} -> ${srcs.map((s) => s.w).join(', ')}`);
}
for (const f of FILES) {
  if (!fs.existsSync(f.from)) { console.error(`media: missing ${f.from}`); process.exit(1); }
  fs.copyFileSync(f.from, path.join(OUT, f.to));
  console.log(`media: copied ${f.to}`);
}

const body = `// Written by scripts/media.mjs. Do not edit by hand.\n\nexport interface MediaEntry {\n  w: number;\n  h: number;\n  tone: string;\n  srcs: { w: number; h: number; src: string }[];\n}\n\nexport const MEDIA = ${JSON.stringify(list, null, 2)} as const satisfies Record<string, MediaEntry>;\n`;
fs.writeFileSync(LIST, body);
console.log(`media: wrote ${LIST}`);

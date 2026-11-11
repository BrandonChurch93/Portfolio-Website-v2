// Mean luma of regions of images, to put a number on how much a light change moves a shot.
//
//   node scripts/region-luma.mjs <x0> <y0> <x1> <y1> <image> [image ...]
//
// The region is given as fractions of the image, 0 to 1.
import process from 'node:process';
import sharp from 'sharp';

const [x0, y0, x1, y1, ...files] = process.argv.slice(2);
if (!files.length) { console.error('usage: node scripts/region-luma.mjs <x0> <y0> <x1> <y1> <image> [image ...]'); process.exit(1); }
for (const f of files) {
  const img = sharp(f);
  const { width, height } = await img.metadata();
  const left = Math.round(Number(x0) * width), top = Math.round(Number(y0) * height);
  const w = Math.round((Number(x1) - Number(x0)) * width), h = Math.round((Number(y1) - Number(y0)) * height);
  const { data, info } = await img.extract({ left, top, width: w, height: h }).raw().toBuffer({ resolveWithObject: true });
  let sum = 0;
  for (let i = 0; i < data.length; i += info.channels) sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
  console.log(`${f}: mean luma ${(sum / (data.length / info.channels)).toFixed(1)}`);
}

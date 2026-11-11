// A small static file server.
//
//   node scripts/serve.mjs <folder> [port]
//     Serves the folder on 127.0.0.1. With no port it takes the first free one from 5321 to 5329 and prints it.
//
// Other scripts import startServer(folder) and get { port, stop }.
// Paths ending in / serve index.html. A missing path serves 404.html from the folder when it exists.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { freePort } from './free-port.mjs';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.gif': 'image/gif',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.pdf': 'application/pdf', '.webmanifest': 'application/manifest+json', '.wasm': 'application/wasm', '.glb': 'model/gltf-binary',
};

function resolveFile(root, urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  const full = path.normalize(path.join(root, clean));
  if (!full.startsWith(root)) return null;
  const tries = [full, path.join(full, 'index.html'), `${full}.html`];
  for (const t of tries) if (fs.existsSync(t) && fs.statSync(t).isFile()) return t;
  return null;
}

function sendFile(req, res, file, status = 200) {
  const stat = fs.statSync(file);
  const type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
  const range = req.headers.range;
  if (range && status === 200) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    const start = m && m[1] ? Number(m[1]) : 0;
    const end = m && m[2] ? Number(m[2]) : stat.size - 1;
    res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1, 'Cache-Control': 'no-store' });
    fs.createReadStream(file, { start, end }).pipe(res);
    return;
  }
  res.writeHead(status, { 'Content-Type': type, 'Content-Length': stat.size, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' });
  if (req.method === 'HEAD') { res.end(); return; }
  fs.createReadStream(file).pipe(res);
}

export async function startServer(folder, wanted) {
  const root = path.resolve(folder);
  if (!fs.existsSync(root)) throw new Error(`serve: ${folder} does not exist`);
  const port = wanted ? Number(wanted) : await freePort();
  const server = http.createServer((req, res) => {
    const file = resolveFile(root, req.url || '/');
    if (file) return sendFile(req, res, file);
    if ((req.url || '').startsWith('/favicon.ico')) { res.writeHead(204); res.end(); return; }
    const missing = path.join(root, '404.html');
    if (fs.existsSync(missing)) return sendFile(req, res, missing, 404);
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('not found');
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  return { port, stop: () => new Promise((r) => server.close(() => r())) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [folder = 'out', port] = process.argv.slice(2);
  const s = await startServer(folder, port);
  console.log(`serving ${folder} at http://127.0.0.1:${s.port}/`);
}

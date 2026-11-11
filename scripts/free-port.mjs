// Prints the first free port from 5321 to 5329. Other scripts import freePort().
// A busy port is never freed. The next one is taken.
import net from 'node:net';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

export const FIRST_PORT = 5321;
export const LAST_PORT = 5329;

function free(port) {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.once('error', () => resolve(false));
    s.once('listening', () => s.close(() => resolve(true)));
    s.listen(port, '127.0.0.1');
  });
}

export async function freePort() {
  for (let port = FIRST_PORT; port <= LAST_PORT; port++) if (await free(port)) return port;
  throw new Error(`no free port between ${FIRST_PORT} and ${LAST_PORT}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(await freePort()); } catch (e) { console.error(e.message); process.exit(1); }
}

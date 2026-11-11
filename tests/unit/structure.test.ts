import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PIECES } from '../../src/config/site';

const walk = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(dir, e.name);
  return e.isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(e.name) ? [p] : [];
});

// Gauntlet B1: every word a visitor reads comes from src/content/site.ts, so no component holds copy of its own.
describe('copy lives in the content file', () => {
  const literal = (src: string) => [
    ...[...src.matchAll(/>([^<>{}=;()]*[A-Za-z]{2,}[^<>{}=;()]*)</g)].map((m) => m[1].trim()),
    ...[...src.matchAll(/\b(aria-label|alt|title|placeholder)="([^"]*[A-Za-z][^"]*)"/g)].map((m) => `${m[1]}="${m[2]}"`),
  ];
  it('catches copy written into markup', () => expect(literal('<p>Hello there</p><img alt="a cat" />')).toEqual(['Hello there', 'alt="a cat"']));
  const files = [...walk('src/components'), ...walk('src/app')].filter((f) => f.endsWith('.tsx'));
  it('finds the components', () => expect(files.length).toBeGreaterThan(20));
  for (const f of files) {
    it(`${f} has no literal words in its markup or its labels`, () => {
      const src = fs.readFileSync(f, 'utf8').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
      expect(literal(src)).toEqual([]);
    });
  }
});

// Gauntlet E1: six pieces, each in its own folder behind the contract, and no piece imports another.
describe('the pieces stand alone', () => {
  it('has the six pieces, each with a factory', () => {
    expect([...PIECES].sort()).toEqual(['camera', 'city', 'handheld', 'rocket', 'sculpture', 'workbench']);
    for (const p of PIECES) {
      const index = fs.readFileSync(`src/pieces/${p}/index.ts`, 'utf8');
      expect(index, p).toMatch(/export const create\w+: PieceFactory|export function create\w+\(\): Piece/);
    }
  });
  for (const p of PIECES) {
    it(`${p} imports nothing from another piece`, () => {
      const own = path.resolve('src/pieces', p);
      for (const f of walk(own)) {
        const src = fs.readFileSync(f, 'utf8');
        for (const m of src.matchAll(/(?:from|import\()\s*'([^']+)'/g)) {
          if (!m[1].startsWith('.')) continue;
          const to = path.resolve(path.dirname(f), m[1]);
          const piecesDir = path.resolve('src/pieces');
          if (to.startsWith(piecesDir + path.sep)) expect(to.startsWith(own), `${f} imports ${m[1]}`).toBe(true);
        }
      }
    });
  }
});

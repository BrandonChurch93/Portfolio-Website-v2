import { describe, expect, it } from 'vitest';
import { MEDIA } from '../../src/content/media.generated';
import { projectBySlug, projects, site } from '../../src/content/site';

const EM_DASH = String.fromCharCode(8212);

function strings(v: unknown, out: string[] = []): string[] {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => strings(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => strings(x, out));
  return out;
}

describe('content shape', () => {
  it('features exactly the four projects the kit names, in order', () => {
    expect(site.work.featured).toEqual(['pc-builder', 'design-system-extractor', 'red-team-arena', 'ask-the-claude-docs']);
    for (const s of site.work.featured) expect(projectBySlug(s), s).toBeDefined();
  });

  it('gives every project a unique slug, a name, a reason and facts', () => {
    const slugs = projects.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const p of projects) {
      expect(p.slug).toMatch(/^[a-z0-9-]+$/);
      expect(p.name.length).toBeGreaterThan(1);
      expect(p.why.length).toBeGreaterThan(10);
      expect(p.facts.length).toBeGreaterThan(0);
    }
  });

  it('points every picture at a processed media entry, with alt text', () => {
    const refs = [...projects.flatMap((p) => p.media), site.about.portrait];
    for (const m of refs) {
      expect(MEDIA[m.id], m.id).toBeDefined();
      expect(m.alt.length).toBeGreaterThan(8);
    }
    for (const entry of Object.values(MEDIA)) {
      expect(entry.w).toBeGreaterThan(0);
      expect(entry.srcs.length).toBeGreaterThan(0);
    }
  });

  it('has six skill areas in the kit order, each with a note and where it was used', () => {
    expect(site.skills.areas.map((a) => a.name)).toEqual(['Design', 'Engineering', 'AI', '3D and motion', 'Games', 'Photography']);
    for (const a of site.skills.areas) {
      expect(a.note.length).toBeGreaterThan(10);
      expect(a.usedIn.length).toBeGreaterThan(0);
    }
  });

  it('offers only https or mailto contact links', () => {
    for (const l of site.contact.links) expect(l.href).toMatch(/^(https:\/\/|mailto:)/);
    expect(site.contact.links.some((l) => /^tel:/.test(l.href))).toBe(false);
  });

  it('has three room doors and the not found copy from the kit', () => {
    expect(site.rooms.doors.map((d) => d.route)).toEqual(['games', 'photography', 'art3d']);
    expect(site.notFound.line).toBe('This page is not here. The water still runs.');
  });

  it('holds no em dash and no exclamation point anywhere', () => {
    for (const s of strings(site)) {
      expect(s.includes(EM_DASH), s).toBe(false);
      expect(s.includes('!'), s).toBe(false);
    }
  });

  it('never uses the word boudoir', () => {
    for (const s of strings(site)) expect(/boudoir/i.test(s), s).toBe(false);
  });
});

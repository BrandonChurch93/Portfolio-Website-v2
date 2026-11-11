import type { MetadataRoute } from 'next';
import { ROUTES, SHOW_3D_ART, SITE_URL } from '../config/site';
import { projects } from '../content/site';

export const dynamic = 'force-static';

// Every page a visitor can reach. The lab is left out: it is a workbench for building the site.
export default function sitemap(): MetadataRoute.Sitemap {
  const paths = [ROUTES.home, ROUTES.work, ...projects.map((p) => ROUTES.project(p.slug)), ROUTES.clients, ROUTES.skills, ROUTES.games, ROUTES.photography, ...(SHOW_3D_ART ? [ROUTES.art3d] : []), ROUTES.about, ROUTES.resume];
  return paths.map((p) => ({ url: new URL(p, SITE_URL).toString(), changeFrequency: 'monthly', priority: p === ROUTES.home ? 1 : 0.7 }));
}

import type { MetadataRoute } from 'next';
import { SITE_URL } from '../config/site';

export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: '/lab/' },
    sitemap: new URL('/sitemap.xml', SITE_URL).toString(),
  };
}

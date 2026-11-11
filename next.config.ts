import type { NextConfig } from 'next';

const flagsBuild = process.env.SITE_FLAGS_BUILD === '1';
const show3dArt = (process.env.SITE_SHOW_3D_ART ?? 'true') !== 'false';
const showLab = (process.env.SITE_SHOW_LAB ?? 'true') !== 'false';

// A page behind a switch is named page.art.tsx or page.lab.tsx. Its extension is only known to Next.js while the
// switch is on, so with the switch off the route is not generated at all.
const pageExtensions = ['tsx', 'ts', ...(show3dArt ? ['art.tsx'] : []), ...(showLab ? ['lab.tsx'] : [])];

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  distDir: flagsBuild ? 'out-flags' : undefined,
  pageExtensions,
  images: { unoptimized: true },
  reactStrictMode: true,
  poweredByHeader: false,
  generateBuildId: async () => 'brandon-church-static',
  env: {
    SITE_SHOW_3D_ART: show3dArt ? 'true' : 'false',
    SITE_SHOW_LAB: showLab ? 'true' : 'false',
  },
};

export default nextConfig;

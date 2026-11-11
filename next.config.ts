import type { NextConfig } from 'next';

const flagsBuild = process.env.SITE_FLAGS_BUILD === '1';

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  distDir: flagsBuild ? 'out-flags' : undefined,
  images: { unoptimized: true },
  reactStrictMode: true,
  poweredByHeader: false,
  generateBuildId: async () => 'brandon-church-static',
  env: {
    SITE_SHOW_3D_ART: process.env.SITE_SHOW_3D_ART ?? 'true',
    SITE_SHOW_LAB: process.env.SITE_SHOW_LAB ?? 'true',
  },
};

export default nextConfig;

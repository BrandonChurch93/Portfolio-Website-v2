import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import '@fontsource-variable/sora';
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import '../styles/tokens.css';
import '../styles/global.css';
import { COLORS, OG_IMAGE, SITE_NAME, SITE_URL } from '../config/site';
import { site } from '../content/site';
import { Footer } from '../components/Footer';
import { Nav } from '../components/Nav';
import { Runtime } from '../components/Runtime';
import { Water } from '../components/Water';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME} · ${site.meta.home.title}`, template: `%s · ${SITE_NAME}` },
  description: site.meta.home.description,
  applicationName: SITE_NAME,
  authors: [{ name: SITE_NAME }],
  openGraph: { type: 'website', siteName: SITE_NAME, url: SITE_URL, images: [{ url: OG_IMAGE.src, width: OG_IMAGE.width, height: OG_IMAGE.height, alt: site.share.alt }] },
  twitter: { card: 'summary_large_image', images: [OG_IMAGE.src] },
};

export const viewport: Viewport = {
  themeColor: COLORS.bg,
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Nav />
        <Water />
        {children}
        <Footer />
        <Runtime />
      </body>
    </html>
  );
}

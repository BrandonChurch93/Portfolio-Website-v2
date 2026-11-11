import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import '@fontsource-variable/sora';
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import '../styles/tokens.css';
import '../styles/global.css';
import { COLORS, SITE_NAME, SITE_URL } from '../config/site';
import { site } from '../content/site';
import { Footer } from '../components/Footer';
import { Nav } from '../components/Nav';
import { Runtime } from '../components/Runtime';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME} · ${site.meta.home.title}`, template: `%s · ${SITE_NAME}` },
  description: site.meta.home.description,
  applicationName: SITE_NAME,
  authors: [{ name: SITE_NAME }],
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
        {children}
        <Footer />
        <Runtime />
      </body>
    </html>
  );
}

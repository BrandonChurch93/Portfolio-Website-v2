import { SITE_NAME } from '../config/site';

export default function Home() {
  return (
    <main style={{ padding: '20vh 8vw', fontFamily: 'var(--font-display)', color: 'var(--text)' }}>
      <h1 style={{ fontWeight: 300, letterSpacing: '-0.04em', fontSize: 'clamp(2.5rem, 6vw, 7rem)', margin: 0 }}>{SITE_NAME}</h1>
    </main>
  );
}

import { SITE_NAME } from '../config/site';
import { site } from '../content/site';
import { ExternalLink } from './ExternalLink';
import styles from './Footer.module.css';

export function Footer() {
  return (
    <footer className={styles.foot}>
      <div className={styles.inner}>
        <p className={styles.line}>{site.footer.line}</p>
        <ul className={styles.links}>
          {site.contact.links.map((l) => (
            <li key={l.href}>
              <ExternalLink href={l.href} className={styles.link}>{l.label}</ExternalLink>
            </li>
          ))}
        </ul>
        <p className={styles.name}>{SITE_NAME}</p>
      </div>
    </footer>
  );
}

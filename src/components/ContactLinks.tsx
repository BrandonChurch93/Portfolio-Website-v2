import { site } from '../content/site';
import { ExternalLink } from './ExternalLink';
import styles from './ContactLinks.module.css';

export function ContactLinks() {
  return (
    <ul className={styles.links}>
      {site.contact.links.map((l) => (
        <li key={l.href}>
          <ExternalLink href={l.href} className={styles.link}>{l.label}</ExternalLink>
        </li>
      ))}
    </ul>
  );
}

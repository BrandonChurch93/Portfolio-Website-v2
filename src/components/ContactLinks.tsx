import { site } from '../content/site';
import { MetalLink } from './MetalLink';
import styles from './ContactLinks.module.css';

// The places to find me, as a row of aged brass controls.
export function ContactLinks() {
  return (
    <ul className={styles.links} data-water-avoid="">
      {site.contact.links.map((l) => (
        <li key={l.href}>
          <MetalLink href={l.href} label={l.label} finish="aged" className={styles.link} />
        </li>
      ))}
    </ul>
  );
}

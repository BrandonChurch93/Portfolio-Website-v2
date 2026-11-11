import type { ReactNode } from 'react';
import page from './Page.module.css';

export function PageHead({ title, lede, children }: { title: string; lede?: string; children?: ReactNode }) {
  return (
    <header className={page.head}>
      <h1 className={page.title}>{title}</h1>
      {lede ? <p className={page.lede}>{lede}</p> : null}
      {children}
    </header>
  );
}

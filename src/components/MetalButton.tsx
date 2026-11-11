'use client';

import type { CSSProperties, KeyboardEvent } from 'react';
import { Plate } from './Plate';
import styles from './MetalButton.module.css';

// A choice in a row of choices, as a small lit plate: polished brass when it is the one chosen, dark bronze when not.
// Both plates are always there and cross over, so a choice never waits for a new plate to be made.
export function MetalButton({ label, selected, onSelect, id, controls }: { label: string; selected: boolean; onSelect: () => void; id?: string; controls?: string }) {
  return (
    <button
      type="button"
      role="tab"
      id={id}
      aria-selected={selected}
      aria-controls={controls}
      tabIndex={selected ? 0 : -1}
      className={styles.button}
      data-selected={selected ? 'yes' : 'no'}
      style={{ '--chars': label.length } as CSSProperties}
      onClick={onSelect}
    >
      <span className={styles.face} data-face="off" aria-hidden="true"><Plate finish="bronze" kind="control" label={label} tilt={false} className={styles.plate} /></span>
      <span className={styles.face} data-face="on" aria-hidden="true"><Plate finish="polished" kind="control" label={label} tilt={false} className={styles.plate} /></span>
      <span className="visually-hidden">{label}</span>
    </button>
  );
}

// Left and right move between the choices in a row, as a tab list does.
export function onTabKeys(e: KeyboardEvent<HTMLElement>): void {
  if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'Home' && e.key !== 'End') return;
  const tabs = [...e.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]')];
  const at = tabs.indexOf(document.activeElement as HTMLElement);
  if (at < 0) return;
  e.preventDefault();
  const to = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (at + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
  tabs[to].focus();
  tabs[to].click();
}

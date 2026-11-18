import {useEffect, useState, type ReactNode} from 'react';

import styles from './styles.module.css';

type Kind = 'core' | 'app' | 'plugin' | 'tool' | 'other';

const FILTERS: Array<[string, Kind | 'all']> = [
  ['All', 'all'],
  ['Core', 'core'],
  ['App', 'app'],
  ['Plugins', 'plugin'],
  ['Tools and SDKs', 'tool'],
];

const TOOLS = /^(hc-tui|hc-mcp|hc-plugin-sdk-[a-z]+)\b/;

/** What a release heading is about, from its text. */
function kindOf(title: string): Kind {
  if (/^v\d/.test(title)) return 'core';
  if (/^App v\d/.test(title)) return 'app';
  if (TOOLS.test(title)) return 'tool';
  if (/^hc-[a-z0-9-]+ v\d/.test(title)) return 'plugin';
  return 'other';
}

/** A release's heading and everything under it, up to the next release. */
function entries(): Array<{h2: HTMLElement; body: HTMLElement[]}> {
  const root = document.querySelector('.theme-doc-markdown');
  if (!root) return [];
  return [...root.querySelectorAll<HTMLElement>(':scope > h2')].map((h2) => {
    const body: HTMLElement[] = [];
    for (let el = h2.nextElementSibling as HTMLElement | null; el && el.tagName !== 'H2'; el = el.nextElementSibling as HTMLElement | null)
      body.push(el);
    return {h2, body};
  });
}

/**
 * Filters for the release notes by component. It marks each release
 * heading with its kind, and with a badge when it has upgrade steps, then
 * hides the releases that don't match.
 */
export default function ReleaseFilter(): ReactNode {
  const [kind, setKind] = useState<Kind | 'all'>('all');
  const [shown, setShown] = useState<number | null>(null);

  // Mark every release once: its kind, and whether it has upgrade steps.
  useEffect(() => {
    for (const {h2, body} of entries()) {
      const title = h2.textContent?.replace(/#$/, '').trim() ?? '';
      h2.dataset.kind = kindOf(title);
      if (body.some((el) => el.tagName === 'H3' && /^Upgrad/.test(el.textContent ?? ''))) h2.dataset.upgrade = '';
    }
  }, []);

  useEffect(() => {
    let n = 0;
    for (const {h2, body} of entries()) {
      const k = h2.dataset.kind;
      const show = kind === 'all' || k === kind;
      if (show && k !== 'other') n++;
      for (const el of [h2, ...body]) el.style.display = show ? '' : 'none';
    }
    setShown(n);
  }, [kind]);

  return (
    <div className={styles.bar} role="group" aria-label="Filter the releases">
      {FILTERS.map(([label, k]) => (
        <button
          key={k}
          type="button"
          className={kind === k ? `${styles.chip} ${styles.on}` : styles.chip}
          aria-pressed={kind === k}
          onClick={() => setKind(k)}>
          {label}
        </button>
      ))}
      {shown !== null && <span className={styles.count}>{shown} releases</span>}
    </div>
  );
}

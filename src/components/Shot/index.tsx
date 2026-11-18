import type {ReactNode} from 'react';
import useBaseUrl from '@docusaurus/useBaseUrl';

import styles from './styles.module.css';

/** A numbered marker on the picture: its number, then where it sits (percent of width and height). */
export type Pin = [number, number, number];

type Props = {
  /** Path under static/, such as /img/screens/console-room.png */
  src: string;
  alt: string;
  width: number;
  height: number;
  /** Markers on the picture, matched by number to the legend. */
  pins?: Pin[];
  /** What each marker points at: [title, explanation]. */
  legend?: Array<[string, string]>;
  /** A short caption under the picture. */
  caption?: ReactNode;
  /** Show it narrower, for a phone screen. */
  phone?: boolean;
};

/**
 * A screenshot from the app, with optional numbered markers and a legend
 * that explains each one.
 */
export default function Shot({src, alt, width, height, pins = [], legend = [], caption, phone}: Props): ReactNode {
  const url = useBaseUrl(src);
  return (
    <figure className={phone ? `${styles.shot} ${styles.phone}` : styles.shot}>
      <div className={styles.frame}>
        <a href={url} target="_blank" rel="noreferrer" title="Open full size">
          <img src={url} alt={alt} width={width} height={height} loading="lazy" />
        </a>
        {pins.map(([n, x, y]) => (
          <span key={n} className={styles.pin} style={{left: `${x}%`, top: `${y}%`}} aria-hidden="true">
            {n}
          </span>
        ))}
      </div>
      {legend.length > 0 && (
        <ol className={styles.legend}>
          {legend.map(([title, text], i) => (
            <li key={i}>
              <span className={styles.num} aria-hidden="true">
                {i + 1}
              </span>
              <span>
                <strong>{title}</strong> {text}
              </span>
            </li>
          ))}
        </ol>
      )}
      {caption && <figcaption className={styles.caption}>{caption}</figcaption>}
    </figure>
  );
}

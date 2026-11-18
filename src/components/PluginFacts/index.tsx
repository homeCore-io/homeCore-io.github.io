import type {ReactNode} from 'react';
import Link from '@docusaurus/Link';

import styles from './styles.module.css';

type Props = {
  /** Two letters for the plugin's tile. */
  mark: string;
  /** The tile's color, by kind of plugin. */
  kind: 'lights' | 'media' | 'climate' | 'sensors' | 'cameras' | 'weather' | 'hub';
  /** One line on what it connects. */
  summary: ReactNode;
  /** The newest released version, such as 0.1.22. */
  version: string;
  /** Where it runs. */
  runs: string;
  /** How it reaches the hardware, such as "Your network" or "Mysa's cloud". */
  talks: string;
  /** The account it needs, or "None". */
  account: string;
  /** The device types it makes. */
  devices: string[];
  /** Its repository or folder on GitHub. */
  source: string;
  /** The anchor of the page's setup section. */
  setup?: string;
};

const COLORS: Record<Props['kind'], string> = {
  lights: '#9a4a07',
  media: '#7a3b74',
  climate: '#b4531c',
  sensors: '#3f6b3a',
  cameras: '#4a443a',
  weather: '#1f5f8b',
  hub: '#3f6b3a',
};

/** The head of a plugin's page: what it is, at a glance. */
export default function PluginFacts(p: Props): ReactNode {
  return (
    <div className={styles.facts}>
      <div className={styles.top}>
        <span className={styles.mark} style={{background: COLORS[p.kind]}} aria-hidden="true">
          {p.mark}
        </span>
        <p className={styles.summary}>{p.summary}</p>
        <div className={styles.links}>
          <Link className={styles.primary} to={p.setup ?? '#install-and-set-up'}>
            Set it up
          </Link>
          <Link className={styles.ghost} href={p.source}>
            Source
          </Link>
        </div>
      </div>
      <dl className={styles.grid}>
        <div>
          <dt>Latest</dt>
          <dd className={styles.mono}>v{p.version}</dd>
        </div>
        <div>
          <dt>Runs</dt>
          <dd>{p.runs}</dd>
        </div>
        <div>
          <dt>Talks to</dt>
          <dd>{p.talks}</dd>
        </div>
        <div>
          <dt>Account</dt>
          <dd>{p.account}</dd>
        </div>
        <div>
          <dt>Devices</dt>
          <dd className={styles.mono}>{p.devices.join(', ')}</dd>
        </div>
      </dl>
    </div>
  );
}

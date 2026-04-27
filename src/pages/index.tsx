import type {ReactNode} from 'react';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';

import styles from './index.module.css';

function Terminal({children}: {children: ReactNode}) {
  return (
    <div className={styles.terminal}>
      <div className={styles.termBar}>
        <span className={styles.termDot} />
        <span className={styles.termDot} />
        <span className={styles.termDot} />
      </div>
      <div className={styles.termBody}>{children}</div>
    </div>
  );
}

function C({children}: {children: ReactNode}) {
  return <span className={styles.comment}>{children}</span>;
}

function A({children}: {children: ReactNode}) {
  return <span className={styles.accent}>{children}</span>;
}

function D({children}: {children: ReactNode}) {
  return <span className={styles.dim}>{children}</span>;
}

export default function Home(): ReactNode {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title={siteConfig.title}
      description="Open-source home automation built in Rust.">
      <main className={styles.page}>
        <Terminal>
          <div className={styles.line}><C># homeCore</C></div>
          <div className={styles.line}>&nbsp;</div>
          <div className={styles.line}>
            Home automation in Rust. One binary, no cloud.
          </div>
          <div className={styles.line}>&nbsp;</div>
          <div className={styles.line}>
            <A>mqtt</A>  Embedded broker (rumqttd). No external dependencies.
          </div>
          <div className={styles.line}>
            <A>rules</A> RON files on disk. Triggers, conditions, actions.
          </div>
          <div className={styles.line}>
            <A>api</A>   REST + WebSocket. Everything is an endpoint.
          </div>
          <div className={styles.line}>
            <A>sdk</A>   Rust, Python, Node.js, .NET. Write a plugin in anything.
          </div>
          <div className={styles.line}>
            <A>local</A> Solar events from lat/lon. Runs without internet.
          </div>
          <div className={styles.line}>&nbsp;</div>
          <div className={styles.line}>&nbsp;</div>
          <div className={styles.line}><C># plugins</C></div>
          <div className={styles.line}>&nbsp;</div>
          <div className={styles.line}>
            <D>hc-lutron</D>  RadioRA2 / Caseta
          </div>
          <div className={styles.line}>
            <D>hc-hue</D>     Philips Hue
          </div>
          <div className={styles.line}>
            <D>hc-zwave</D>   Z-Wave JS
          </div>
          <div className={styles.line}>
            <D>hc-yolink</D>  YoLink sensors
          </div>
          <div className={styles.line}>
            <D>hc-sonos</D>   Sonos speakers
          </div>
          <div className={styles.line}>
            <D>hc-wled</D>    WLED controllers
          </div>
          <div className={styles.line}>
            <D>hc-isy</D>     ISY/IoX (Insteon)
          </div>
          <div className={styles.line}>&nbsp;</div>
          <div className={styles.line}><C># status</C></div>
          <div className={styles.line}>&nbsp;</div>
          <div className={styles.line}>
            Work in progress. Runs my house. Not yet packaged for yours.
          </div>
          <div className={styles.line}>
            Contributions welcome when it's ready.
          </div>
        </Terminal>

        <nav className={styles.links}>
          <Link to="/docs/getting-started/quickstart">docs</Link>
          <span className={styles.sep}>/</span>
          <a href="https://github.com/homeCore-io/homeCore">github</a>
          <span className={styles.sep}>/</span>
          <Link to="/blog">blog</Link>
        </nav>
      </main>
    </Layout>
  );
}

import type {ReactNode} from 'react';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';

import styles from './index.module.css';

function Hero() {
  return (
    <section className={styles.hero}>
      <img src="/img/logo-2.png" className={styles.heroLogo} alt="homeCore logo" />
      <h1 className={styles.heroTitle}>
        <span className={styles.heroTitleHome}>home</span>Core
      </h1>
      <p className={styles.heroSub}>
        Open-source home automation built in Rust. MQTT-native, API-first, and fully local — no cloud required.
      </p>
      <div className={styles.heroBadges}>
        <span className={styles.badge}>Rust + Tokio</span>
        <span className={styles.badge}>MQTT-native</span>
        <span className={styles.badge}>Rule Engine</span>
        <span className={styles.badge}>Plugin SDK</span>
        <span className={styles.badge}>No Cloud</span>
        <span className={styles.badge}>REST + WebSocket</span>
      </div>
      <div className={styles.heroCtas}>
        <Link to="/docs/getting-started/quickstart" className={styles.ctaPrimary}>
          Get Started →
        </Link>
        <a
          href="https://github.com/homeCore-io/homeCore"
          className={styles.ctaSecondary}
          target="_blank"
          rel="noopener noreferrer"
        >
          View on GitHub
        </a>
      </div>
      <div className={styles.heroCode}>
        <div className={styles.heroCodeComment}># clone and run in under 5 minutes</div>
        <div><span className={styles.heroCodeCmd}>git clone</span> https://github.com/homeCore-io/homeCore</div>
        <div><span className={styles.heroCodeCmd}>cd</span> homeCore/core</div>
        <div><span className={styles.heroCodeCmd}>cargo run</span> --release</div>
        <div className={styles.heroCodeComment}># → http://localhost:8080</div>
      </div>
    </section>
  );
}

function Stats() {
  return (
    <div className={styles.stats}>
      <div className={styles.statsGrid}>
        <div>
          <div className={styles.statNum}>~0ms</div>
          <div className={styles.statLabel}>GC pauses (Rust)</div>
        </div>
        <div>
          <div className={styles.statNum}>8+</div>
          <div className={styles.statLabel}>Device plugins</div>
        </div>
        <div>
          <div className={styles.statNum}>40+</div>
          <div className={styles.statLabel}>Rule action types</div>
        </div>
        <div>
          <div className={styles.statNum}>100%</div>
          <div className={styles.statLabel}>Local — no cloud</div>
        </div>
      </div>
    </div>
  );
}

const FEATURES = [
  {
    icon: '⚡',
    title: 'MQTT-Native Core',
    body: (
      <>
        An embedded <strong>rumqttd</strong> broker ships with the binary. Device state always flows through
        MQTT — the universal fabric for all plugins.
      </>
    ),
  },
  {
    icon: '🔁',
    title: 'Powerful Rule Engine',
    body: 'Event-driven automations with 16 trigger types, compound conditions, 40+ action types, Rhai scripting, and per-rule fire history.',
  },
  {
    icon: '🔌',
    title: 'Plugin Architecture',
    body: 'Connect anything via Rust, Python, Node.js, or .NET SDKs. Managed plugins with heartbeat monitoring, remote config, and dynamic log levels.',
  },
  {
    icon: '🌐',
    title: 'API-First',
    body: 'Every operation is available via REST or WebSocket. Build dashboards, mobile apps, and integrations against a clean OpenAPI spec.',
  },
  {
    icon: '🏠',
    title: 'Fully Local',
    body: 'Solar events computed from your lat/lon. No cloud accounts, no subscriptions. Your home runs even when the internet is down.',
  },
  {
    icon: '🦀',
    title: 'Rust Performance',
    body: 'Async Tokio runtime, zero GC pauses, embedded redb state store, and SQLite history. Runs comfortably on a Raspberry Pi 4.',
  },
];

function Features() {
  return (
    <section className={styles.features}>
      <h2 className={styles.sectionTitle}>Everything your home needs</h2>
      <p className={styles.sectionSub}>
        A complete automation stack — broker, state store, rule engine, and API in one binary.
      </p>
      <div className={styles.featureGrid}>
        {FEATURES.map((f) => (
          <div key={f.title} className={styles.featureCard}>
            <div className={styles.featureIcon}>{f.icon}</div>
            <h3>{f.title}</h3>
            <p>{f.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Quickstart() {
  return (
    <section className={styles.quickstart}>
      <div className={styles.qsInner}>
        <div className={styles.qsText}>
          <h2>Up and running in minutes</h2>
          <p>
            homeCore ships as a single Rust binary with an embedded MQTT broker. No external
            databases, no Docker required for a basic install.
          </p>
          <p>
            Connect your first device, write your first rule, and watch your home respond — all
            from a clean REST API or the built-in terminal UI.
          </p>
          <Link to="/docs/getting-started/quickstart">Read the full quickstart guide →</Link>
        </div>
        <div className={styles.codeBlock}>
          <div className={styles.codeComment}># 1. Build</div>
          <div><span className={styles.codePs1}>$</span> cargo build --release -p homecore</div>
          <br />
          <div className={styles.codeComment}># 2. Configure</div>
          <div><span className={styles.codePs1}>$</span> cp config/homecore.toml.example config/homecore.toml</div>
          <br />
          <div className={styles.codeComment}># 3. Run</div>
          <div><span className={styles.codePs1}>$</span> ./target/release/homecore</div>
          <br />
          <div className={styles.codeComment}># 4. Open the TUI dashboard</div>
          <div><span className={styles.codePs1}>$</span> ./hc-tui</div>
        </div>
      </div>
    </section>
  );
}

export default function Home(): ReactNode {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title={siteConfig.title}
      description="Open-source home automation built in Rust. MQTT-native, API-first, and fully local.">
      <Hero />
      <main>
        <Stats />
        <Features />
        <Quickstart />
      </main>
    </Layout>
  );
}

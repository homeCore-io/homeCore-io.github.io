import type {ReactNode} from 'react';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import clsx from 'clsx';
import useBaseUrl from '@docusaurus/useBaseUrl';

import styles from './index.module.css';

/* ── Page ── */

const PILLARS = [
  ['01', 'Built in Rust', 'Devices, automations and the API live in one small Rust program, and the MQTT broker is part of it.'],
  ['02', 'No cloud', 'Sunrise and sunset come from your latitude and longitude, so timed automations work offline too.'],
  ['03', 'Your data stays home', 'Devices, history and backups live on your own machine.'],
  ['04', 'Open source', 'Dual licensed MIT or Apache-2.0. Every repo is on GitHub.'],
];

const PLUGINS: Array<[string, string, string, string, string]> = [
  ['Hu', 'Hue', 'Lights', '#9a4a07', 'hue'],
  ['Lu', 'Lutron RadioRA2', 'Lights and keypads', '#1f5f8b', 'lutron'],
  ['Ca', 'Lutron Caséta', 'Lights and shades', '#1f5f8b', 'caseta'],
  ['Zw', 'Z-Wave JS', 'Z-Wave devices', '#3f6b3a', 'zwave'],
  ['Yo', 'YoLink', 'Sensors, locks, plugs', '#3f6b3a', 'yolink'],
  ['IS', 'ISY / IoX', 'Insteon, Z-Wave, Zigbee', '#3f6b3a', 'isy'],
  ['So', 'Sonos', 'Speakers', '#7a3b74', 'sonos'],
  ['Ro', 'Roku', 'Players and TVs', '#7a3b74', 'roku'],
  ['WL', 'WLED', 'LED strips', '#9a4a07', 'wled'],
  ['Re', 'Reolink', 'Cameras', '#4a443a', 'reolink'],
  ['Ec', 'Ecowitt', 'Weather stations', '#1f5f8b', 'ecowitt'],
  ['We', 'Weather', 'Forecasts and warnings', '#1f5f8b', 'weather'],
  ['My', 'Mysa', 'Thermostats', '#b4531c', 'mysa'],
  ['Nu', 'NuHeat', 'Floor heating', '#b4531c', 'nuheat'],
  ['Th', 'Thermostat', 'Software thermostats', '#b4531c', 'thermostat'],
];

const LOOKS: Array<[string, string, string]> = [
  ['Console', '#0d1015', '#f2b544'],
  ['Classic', '#f3f0e8', '#9a4a07'],
  ['Sage', '#eef2ea', '#3f6b3a'],
  ['Harbour', '#edf2f6', '#1f5f8b'],
  ['Plum', '#f4eef3', '#7a3b74'],
];

function Ticks({items}: {items: string[]}) {
  return (
    <ul className={styles.ticks}>
      {items.map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ul>
  );
}

export default function Home(): ReactNode {
  return (
    <Layout
      title="Home automation on your own hardware"
      description="homeCore is open-source home automation that runs on your own hardware. Core is written in Rust, with no cloud account and no subscription.">
      <main className={styles.page}>
        <section className={styles.hero}>
          <div className={styles.wrap}>
            <div className={styles.heroText}>
              <Link to="/docs/release-notes" className={styles.news}>
                <span>New</span>The Console is now the app's default look
              </Link>
              <h1>
                Home automation that runs on <em>your own hardware</em>.
              </h1>
              <p>
                Core is written in Rust. No cloud account, no subscription, and the house keeps running when the
                internet doesn't.
              </p>
              <div className={styles.ctas}>
                <Link className={styles.btnPrimary} to="/docs/getting-started/docker">
                  Install with Docker
                </Link>
                <Link className={styles.btnGhost} to="/docs/web-ui/overview">
                  Take the tour
                </Link>
              </div>
              <p className={styles.meta}>Free and open source · MIT or Apache-2.0 · 15 plugins</p>
            </div>
            <div className={styles.heroShot}>
              <img
                className={styles.shot}
                src={useBaseUrl('/img/screens/console-home.png')}
                width={1395}
                height={1228}
                alt="homeCore's Console: the Everywhere views and every room down the side, a greeting with what needs attention, the weather, scenes, and a tile for each room lit by its lights"
              />
            </div>
          </div>
        </section>

        <section className={styles.after}>
          <div className={styles.wrap}>
            <div className={styles.pillars}>
              {PILLARS.map(([n, t, b]) => (
                <div key={n} className={styles.card}>
                  <span className={styles.mark}>{n}</span>
                  <h3>{t}</h3>
                  <p>{b}</p>
                </div>
              ))}
            </div>

            <div className={styles.feature}>
              <div className={styles.fText}>
                <div className={styles.eyebrow}>Rooms first</div>
                <h2>The whole house at a glance.</h2>
                <p className={styles.lead}>
                  Every room has its own picture, lit by its lights. Room on and Room off switch it all; tabs open
                  the lights, media, climate and doors inside.
                </p>
                <Ticks
                  items={[
                    'Faders and scenes side by side, like a lighting desk',
                    'Open doors, low batteries and offline devices called out',
                  ]}
                />
                <Link className={styles.more} to="/docs/web-ui/overview">
                  Read: the app
                </Link>
              </div>
              <div className={styles.fPic}>
                <img
                  className={styles.shot}
                  src={useBaseUrl('/img/screens/console-room.png')}
                  width={1395}
                  height={1228}
                  loading="lazy"
                  alt="A room in the Console: its picture, Room on and Room off, a tab for each kind of device, light faders grouped by Hue and Lutron with the group's scenes, and the room's audio along the bottom"
                />
              </div>
            </div>

            <div className={clsx(styles.feature, styles.flip)}>
              <div className={styles.fText}>
                <div className={styles.eyebrow}>Automations</div>
                <h2>Automations you can read.</h2>
                <p className={styles.lead}>
                  Each automation reads as When, If and Then. Build one in the editor or keep it as a text file. A dry
                  run shows what it would do at a time you pick, without touching a device.
                </p>
                <Ticks
                  items={[
                    'Sunrise and sunset worked out offline',
                    'When a device goes missing, homeCore names it and lets you point the automation at another one',
                  ]}
                />
                <Link className={styles.more} to="/docs/rules/overview">
                  Read: how automations work
                </Link>
              </div>
              <div className={styles.fPic}>
                <div className={clsx(styles.card, styles.rule)}>
                  <div className={styles.ruleHead}>
                    <b>Porch lights at sunset</b>
                    <span className={styles.on}>On</span>
                  </div>
                  {[
                    ['WHEN', "It's 15 minutes before sunset"],
                    ['IF', 'Away mode is off'],
                    ['THEN', 'Turn the porch lights on to 80%'],
                  ].map(([k, v]) => (
                    <div key={k} className={styles.ruleRow}>
                      <span>{k}</span>
                      {v}
                    </div>
                  ))}
                  <div className={styles.ruleBtns}>
                    <span>Dry run at 4:30 PM</span>
                    <span>Run now</span>
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.feature}>
              <div className={styles.fText}>
                <div className={styles.eyebrow}>Make it yours</div>
                <h2>Looks for every wall.</h2>
                <p className={styles.lead}>
                  Choose a look for the whole house or just for yourself. The Console suits a desk, and Classic suits
                  a tablet on the wall.
                </p>
                <Link className={styles.more} to="/docs/web-ui/looks">
                  Read: looks
                </Link>
              </div>
              <div className={styles.fPic}>
                <div className={styles.looks}>
                  {LOOKS.map(([name, bg, accent]) => (
                    <div key={name} className={styles.look}>
                      <div className={styles.lookTile} style={{background: bg}}>
                        <i style={{background: accent}} />
                        <i style={{background: accent, opacity: 0.35, width: 46, height: 10}} />
                        <i style={{background: accent, opacity: 0.2, width: 30, height: 10}} />
                      </div>
                      <b>{name}</b>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className={clsx(styles.feature, styles.flip)}>
              <div className={styles.fText}>
                <div className={styles.eyebrow}>The Assistant</div>
                <h2>Ask the house.</h2>
                <p className={styles.lead}>
                  An optional plugin that answers questions about your home and acts on them, using the same
                  permissions as the person asking.
                </p>
                <Link className={styles.more} to="/docs/plugins/assistant">
                  Read: the Assistant
                </Link>
              </div>
              <div className={styles.fPic}>
                <div className={clsx(styles.card, styles.chat)}>
                  <div className={styles.me}>Is anything left open downstairs?</div>
                  <div className={styles.it}>
                    The garage door has been open for 25 minutes. Every other door and window downstairs is closed.
                    Want me to close the garage?
                  </div>
                  <div className={styles.chatBtns}>
                    <span>Close it</span>
                    <span>Leave it</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.plugins}>
          <div className={styles.wrap}>
            <div className={styles.plugHead}>
              <div>
                <div className={styles.eyebrow}>Plugins</div>
                <h2>Works with what you already own.</h2>
              </div>
              <Link className={styles.more} to="/docs/plugins/overview">
                Browse all plugins
              </Link>
            </div>
            <div className={styles.plugGrid}>
              {PLUGINS.map(([m, n, k, c, slug]) => (
                <Link key={slug} to={`/docs/plugins/${slug}`} className={styles.plug}>
                  <span style={{background: c}}>{m}</span>
                  <span>
                    <b>{n}</b>
                    <small>{k}</small>
                  </span>
                </Link>
              ))}
            </div>
            <p className={styles.sdk}>
              Or write your own in Rust, Python, Node or .NET.{' '}
              <Link to="/docs/plugins/developing-plugins">Plugin SDK guide</Link>
            </p>
          </div>
        </section>

        <section className={styles.duo}>
          <div className={clsx(styles.wrap, styles.duoRow)}>
            <div className={clsx(styles.card, styles.dark)}>
              <div className={styles.eyebrow}>For tinkerers</div>
              <h3>Everything is an endpoint.</h3>
              <p>The app, the terminal UI and the Assistant all use the same REST and WebSocket API. So can your scripts.</p>
              <pre>
                <span># every light in a room on</span>
                {'\ncurl -X POST $HC/api/v1/areas/$ROOM/on \\\n  -H "Authorization: Bearer $TOKEN"'}
              </pre>
            </div>
            <div className={styles.card}>
              <div className={styles.eyebrow}>Getting started</div>
              <h3>Running in three steps.</h3>
              {[
                ['1', 'Start two containers', 'Core and the app, with one compose file.'],
                ['2', 'Install plugins from the Catalog', 'Pick your hardware; homeCore finds the devices.'],
                ['3', 'Sort devices into rooms', 'Then add your first automation.'],
              ].map(([n, t, b]) => (
                <div key={n} className={styles.step}>
                  <span>{n}</span>
                  <div>
                    <b>{t}</b>
                    <small>{b}</small>
                  </div>
                </div>
              ))}
              <Link className={styles.btnPrimary} to="/docs/getting-started/docker">
                Start the guide
              </Link>
            </div>
          </div>
        </section>

        <section className={styles.wip}>
          <div className={styles.wrap}>
            <div className={styles.wipBox}>
              <div>
                <b>A work in progress, running a real house.</b>
                <span>Not yet packaged for yours. Follow along on the blog, or read what changed in each release.</span>
              </div>
              <Link to="/docs/release-notes">Release notes</Link>
              <Link to="/blog">Blog</Link>
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}

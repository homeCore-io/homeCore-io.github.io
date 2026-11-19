// @ts-check

/**
 * The docs, grouped by what people come to do: get started, use the app,
 * automate, connect hardware, run the box, and build on it.
 *
 * @type {import('@docusaurus/plugin-content-docs').SidebarsConfig}
 */
const sidebars = {
  docs: [
    {
      type: 'category',
      label: 'Start here',
      collapsed: false,
      items: [
        {type: 'doc', id: 'intro', label: 'What is homeCore'},
        {type: 'doc', id: 'getting-started/docker', label: 'Install with Docker'},
        'getting-started/installation',
        'getting-started/binary-releases',
        'getting-started/quickstart',
        'getting-started/configuration',
        'getting-started/migration',
      ],
    },
    {
      type: 'category',
      label: 'Using the app',
      collapsed: false,
      items: [
        {type: 'doc', id: 'web-ui/overview', label: 'A tour of the app'},
        'web-ui/home',
        'web-ui/rooms',
        'web-ui/everywhere',
        'devices/scenes',
        {type: 'doc', id: 'devices/virtual-devices', label: 'Helpers'},
        'web-ui/looks',
        'web-ui/extensions',
      ],
    },
    {
      type: 'category',
      label: 'Automations',
      items: [
        'rules/overview',
        'rules/editor',
        'rules/triggers',
        'rules/conditions',
        'rules/actions',
        'rules/advanced',
        'rules/tags-groups',
        'rules/examples',
        'rules/alert-automations',
      ],
    },
    {
      type: 'category',
      label: 'Devices and plugins',
      items: [
        'devices/overview',
        'devices/battery-monitoring',
        'plugins/overview',
        'plugins/runtimes',
        'plugins/assistant',
        {
          type: 'category',
          label: 'All plugins',
          items: [
            'plugins/caseta',
            'plugins/ecowitt',
            'plugins/hue',
            'plugins/isy',
            'plugins/lutron',
            'plugins/mysa',
            'plugins/nuheat',
            'plugins/reolink',
            'plugins/roku',
            'plugins/sonos',
            'plugins/thermostat',
            'plugins/weather',
            'plugins/wled',
            'plugins/yolink',
            'plugins/zwave',
          ],
        },
      ],
    },
    {
      type: 'category',
      label: 'Alerts and notifications',
      items: ['events/alerts', 'events/notifications'],
    },
    {
      type: 'category',
      label: 'Running homeCore',
      items: [
        'administration/users-auth',
        'administration/backup-restore',
        'administration/logging',
        'administration/audit-log',
        'administration/metrics',
        'administration/system-status',
        'administration/broker',
        'administration/systemd-deployment',
        'administration/deployment-checklist',
      ],
    },
    {
      type: 'category',
      label: 'Tools',
      items: ['tools/hc-cli', 'tools/hc-tui', 'tools/hc-mcp', 'tools/skills'],
    },
    {
      type: 'category',
      label: 'Building',
      items: [
        'plugins/developing-plugins',
        'plugins/capabilities',
        'plugins/plugin-screens',
        'plugins/plugin-alerts',
        'web-ui/making-extensions',
        'events/event-stream',
        {
          type: 'category',
          label: 'Core development',
          items: [
            'development/workspace',
            'development/dev-workflow',
            'development/architecture',
            'development/adding-features',
            'development/topic-mapper',
          ],
        },
      ],
    },
    'release-notes',
  ],
};

module.exports = sidebars;

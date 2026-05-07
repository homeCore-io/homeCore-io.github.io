// @ts-check

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  docs: [
    'intro',
    {
      type: 'category',
      label: 'Getting Started',
      collapsed: false,
      items: [
        'getting-started/binary-releases',
        'getting-started/installation',
        'getting-started/quickstart',
        'getting-started/configuration',
        'getting-started/docker',
        'getting-started/migration',
      ],
    },
    {
      type: 'category',
      label: 'Administration',
      items: [
        'administration/users-auth',
        'administration/audit-log',
        'administration/logging',
        'administration/broker',
        'administration/backup-restore',
        'administration/metrics',
        'administration/system-status',
        'administration/systemd-deployment',
        'administration/deployment-checklist',
      ],
    },
    {
      type: 'category',
      label: 'Rules & Automation',
      collapsed: false,
      items: [
        'rules/overview',
        'rules/triggers',
        'rules/conditions',
        'rules/actions',
        'rules/advanced',
        'rules/tags-groups',
        'rules/examples',
      ],
    },
    {
      type: 'category',
      label: 'Devices',
      items: [
        'devices/overview',
        'devices/virtual-devices',
        'devices/scenes',
        'devices/battery-monitoring',
      ],
    },
    {
      type: 'category',
      label: 'Web UI',
      items: [
        'web-ui/overview',
      ],
    },
    {
      type: 'category',
      label: 'Events & Notifications',
      items: [
        'events/event-stream',
        'events/notifications',
      ],
    },
    {
      type: 'category',
      label: 'Plugins',
      items: [
        'plugins/overview',
        'plugins/developing-plugins',
        'plugins/capabilities',
        'plugins/http-poller',
        'plugins/hue',
        'plugins/yolink',
        'plugins/lutron',
        'plugins/caseta',
        'plugins/sonos',
        'plugins/zwave',
        'plugins/wled',
        'plugins/isy',
        'plugins/thermostat',
        'plugins/ecowitt',
      ],
    },
    {
      type: 'category',
      label: 'Tools & Integrations',
      items: [
        'tools/hc-mcp',
        'tools/hc-tui',
      ],
    },
    {
      type: 'category',
      label: 'Core Development',
      items: [
        'development/workspace',
        'development/dev-workflow',
        'development/architecture',
        'development/adding-features',
        'development/topic-mapper',
      ],
    },
    'release-notes',
  ],
};

module.exports = sidebars;

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
        'administration/logging',
        'administration/broker',
        'administration/backup-restore',
        'administration/metrics',
        'administration/system-status',
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
        'plugins/http-poller',
        'plugins/hue',
        'plugins/yolink',
        'plugins/lutron',
        'plugins/sonos',
        'plugins/zwave',
        'plugins/wled',
        'plugins/isy',
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
  ],
};

module.exports = sidebars;

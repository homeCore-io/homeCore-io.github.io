---
id: notifications
title: Notifications
sidebar_label: Notifications
sidebar_position: 2
---

# Notifications (`hc-notify`)

HomeCore can send notifications by Telegram, Pushover and email. Channels are configured in `homecore.toml`, and the web app edits them in **Settings → Notifications**, which can also send a test and shows the automations that use each channel. Channels are read when HomeCore starts, so a new or changed channel takes effect after a restart.

What sends notifications:

- the `Notify` rule action, and `notify(…)` in a rule script
- the battery watcher, through `[battery] notify_channel` (see [Battery monitoring](../devices/battery-monitoring.md))
- HomeCore's built-in alerts for something wet, smoky, jammed or offline, through `[alerts] notify_channel` (unset, they are shown in the app but not sent)
- a time rule in **Settings → Alerts** that names a channel

## Configuration

Each channel is a `[[notify.channels]]` entry with a `name` (what rules refer to) and a `type`:

```toml
# homecore.toml

[[notify.channels]]
name      = "telegram"
type      = "telegram"
bot_token = "123456789:ABCDEFxxxxxxxxxxxxxxxxxxxxxxx"
chat_id   = "-1001234567890"

[[notify.channels]]
name      = "pushover"
type      = "pushover"
api_token = "your-pushover-app-token"
user_key  = "your-pushover-user-key"

[[notify.channels]]
name      = "email-alerts"
type      = "email"
smtp_host = "smtp.yourdomain.com"
smtp_port = 587
username  = "homecore@yourdomain.com"
password  = "smtp-password"
from      = "homecore@yourdomain.com"
to        = ["you@yourdomain.com", "partner@yourdomain.com"]
```

## Notify action

```ron
// Send to one channel
RuleAction(action: Notify(
    channel: "telegram",
    message: "Front door opened",
    title: Some("Security Alert"),   // optional; default "HomeCore Alert"
)),

// Send to every configured channel
RuleAction(action: Notify(
    channel: "all",
    message: "Critical alert!",
)),
```

A failed notification (an unknown channel, a misconfigured provider, a network error) is logged as a warning and doesn't stop the rule: the next action still runs. With `all`, a failure on one channel doesn't stop delivery to the others.

The message is sent as written. The exception is a rule started by an alert, where placeholders such as `{alert.message}`, `{alert.device}` and `{alert.raised_at}` are filled in; see [Alerts that start automations](../rules/alert-automations.md). To put a device's current reading in a message, send it from a `RunScript` action: `notify(channel, message)` sends with the default title and `notify_titled(channel, title, message)` sets one.

## Telegram

### Getting credentials

1. Message [@BotFather](https://t.me/BotFather) on Telegram.
2. Send `/newbot` and follow the prompts. You get a `bot_token`.
3. Add the bot to your channel or group, or send it a message.
4. Get the `chat_id`:
   ```bash
   curl "https://api.telegram.org/bot{TOKEN}/getUpdates" | jq '.result[0].message.chat.id'
   ```

For a personal chat, the `chat_id` is your numeric user ID. For a group or channel it is negative, and a channel's starts with `-100`.

### Configuration

```toml
[[notify.channels]]
name      = "telegram"
type      = "telegram"
bot_token = "123456789:ABCDEFxxxxxxxxxxxxxxxxxxxxxxx"
chat_id   = "-1001234567890"
# markdown = true   # optional: send with Telegram's MarkdownV2 formatting
```

The title, when there is one, is sent as the first line of the message. If `bot_token` or `chat_id` is still the shipped placeholder `CHANGE_ME`, HomeCore refuses to start rather than drop every notification later.

With `markdown = true`, messages can use MarkdownV2 formatting, which also means MarkdownV2's special characters must be escaped:

```ron
RuleAction(action: Notify(
    channel: "telegram",
    message: "*Alert\\!* Front door opened at `07:30`",
    title: Some("Security"),
)),
```

### Testing

```bash
curl -s -X POST http://localhost:8080/api/v1/notify/test \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"channel": "telegram", "message": "Test from HomeCore"}'
# → {"sent": true, "channel": "telegram"}
```

The test endpoint is for admins. `channel` can also be `all`. Leave `message` out and HomeCore sends a message that identifies itself; the title is always "homeCore". A failure answers `502` with the provider's error, and `503` means no channels are configured at all. Each test is recorded in the audit log.

## Pushover

### Configuration

```toml
[[notify.channels]]
name      = "pushover"
type      = "pushover"
api_token = "your-pushover-application-token"   # from your Pushover application
user_key  = "your-pushover-user-key"            # your user or group key
# device   = "my-iphone"   # optional: one device; omit for all of the user's devices
# priority = 0             # optional: -2 (lowest) to 2 (emergency); default 0
# retry    = 60            # emergency only: seconds between repeats (at least 30); default 60
# expire   = 3600          # emergency only: stop repeating after this many seconds (at most 10800); default 3600
```

An emergency message (priority 2) repeats until someone acknowledges it or `expire` runs out. HomeCore keeps `retry` and `expire` inside Pushover's limits.

### Multiple Pushover channels

Use separate channel entries for different priorities or people:

```toml
[[notify.channels]]
name      = "pushover-normal"
type      = "pushover"
api_token = "app-token"
user_key  = "your-user-key"
priority  = 0

[[notify.channels]]
name      = "pushover-urgent"
type      = "pushover"
api_token = "app-token"
user_key  = "your-user-key"
priority  = 1      # high priority: bypasses the user's quiet hours
```

## Email

### Configuration

```toml
[[notify.channels]]
name      = "email-alerts"
type      = "email"
smtp_host = "smtp.yourdomain.com"
smtp_port = 587               # optional; default 587
username  = "homecore@yourdomain.com"
password  = "app-password"
from      = "homecore@yourdomain.com"
to        = ["you@yourdomain.com"]
starttls  = true              # optional; default true (STARTTLS, port 587). false = implicit TLS (port 465)
```

The notification's title becomes the email subject. If HomeCore can't set up an email channel at startup, it logs the error and skips that channel rather than refusing to start.

### Gmail example

Use an [App Password](https://support.google.com/accounts/answer/185833), not your account password:

```toml
[[notify.channels]]
name      = "gmail"
type      = "email"
smtp_host = "smtp.gmail.com"
smtp_port = 587
username  = "youraddress@gmail.com"
password  = "xxxx-xxxx-xxxx-xxxx"   # 16-character app password
from      = "youraddress@gmail.com"
to        = ["youraddress@gmail.com"]
starttls  = true
```

### Troubleshooting

Common email failures:

| Error | Likely cause |
|---|---|
| `Connection refused` | Wrong SMTP host or port |
| `Authentication failed` | Wrong username or password; try an app password |
| `TLS handshake failed` | Use `starttls = true` for port 587, or `starttls = false` for port 465 |
| `Relay denied` | The SMTP server requires authentication; check username and password |

Test email delivery:

```bash
curl -s -X POST http://localhost:8080/api/v1/notify/test \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"channel": "email-alerts", "message": "Test alert from HomeCore"}'
```

## Worked example: door left open for 10 minutes

A rule that checks every minute and sends to two channels at once, at most once every 10 minutes:

```ron
Rule(
    id: "00000000-0000-0000-0000-000000000000",
    name: "Garage: left open alert",
    enabled: true,
    priority: 10,
    cooldown_secs: Some(600),   // alert at most once per 10 minutes
    trigger: Cron(expression: "0 * * * * *"),   // every minute (sec min hour dom month dow)
    conditions: [
        DeviceState(
            device_id: "yolink_garage_door",
            attribute: "open",
            op: Eq,
            value: true,
        ),
        TimeElapsed(
            device_id: "yolink_garage_door",
            attribute: "open",
            duration_secs: 600,
        ),
    ],
    actions: [
        RuleAction(action: Parallel(actions: [
            Notify(
                channel: "telegram",
                message: "Garage door has been open for 10+ minutes!",
                title: Some("Garage Alert"),
            ),
            Notify(
                channel: "pushover-urgent",
                message: "Garage door has been open for 10+ minutes!",
            ),
        ])),
    ],
)
```

`TimeElapsed` passes when the attribute hasn't changed for at least `duration_secs`. A rule file with the all-zero `id` gets a fresh one when HomeCore first loads it.

## Worked example: multi-channel temperature alert

The temperature goes into the message from a script, since action text isn't filled in from devices:

```ron
Rule(
    id: "00000000-0000-0000-0000-000000000000",
    name: "Temperature: high alert",
    enabled: true,
    priority: 0,
    cooldown_secs: Some(3600),   // once per hour at most
    trigger: DeviceStateChanged(
        device_id: "sensor_basement_temp",
        attribute: Some("temperature"),
    ),
    conditions: [
        DeviceState(
            device_id: "sensor_basement_temp",
            attribute: "temperature",
            op: Gt,
            value: 29,   // °C: every plugin publishes temperatures in °C
        ),
    ],
    actions: [
        RuleAction(action: RunScript(script: r#"
            let t = trigger_value();
            notify_titled("telegram", "Temperature Alert",
                "Basement temperature is " + t + " °C. Check the HVAC!");
            notify_titled("email-alerts", "HomeCore Temperature Alert",
                "Basement temperature alert: " + t + " °C");
        "#)),
    ],
)
```

In a `DeviceStateChanged` rule, `trigger_value()` is the attribute's new value.

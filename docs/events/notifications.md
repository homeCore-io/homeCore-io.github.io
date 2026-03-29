---
id: notifications
title: Notifications
sidebar_label: Notifications
sidebar_position: 2
---

# Notifications (`hc-notify`)

HomeCore can send notifications via Telegram, Pushover, and email. Channels are configured in `homecore.toml` and used by the `Notify` rule action.

## Configuration

```toml
# homecore.toml

[[notify.channels]]
name      = "telegram"
type      = "telegram"
bot_token = "123456789:ABCDEFxxxxxxxxxxxxxxxxxxxxxxx"
chat_id   = "-1001234567890"

[[notify.channels]]
name     = "pushover"
type     = "pushover"
api_key  = "your-pushover-app-key"
user_key = "your-pushover-user-key"

[[notify.channels]]
name = "email-alerts"
type = "email"
from = "homecore@yourdomain.com"
to   = ["you@yourdomain.com", "partner@yourdomain.com"]

[notify.channels.smtp]
host     = "smtp.yourdomain.com"
port     = 587
username = "homecore@yourdomain.com"
password = "smtp-password"
starttls = true
```

## Notify action

```toml
[[actions]]
type    = "notify"
channel = "telegram"
message = "Front door opened"
title   = "Security Alert"   # optional; default: "HomeCore Alert"

# Log to server output only (always available, no config needed)
[[actions]]
type    = "notify"
channel = "log"
message = "Rule fired: debug info here"

# Send to ALL configured channels simultaneously
[[actions]]
type    = "notify"
channel = "all"
message = "Critical alert!"
```

A notification failure (misconfigured channel, network error) logs a warning but does **not** abort the rule action sequence. The next action continues.

## Telegram

### Getting credentials

1. Message [@BotFather](https://t.me/BotFather) on Telegram
2. Send `/newbot` and follow the prompts → you get a `bot_token`
3. Add the bot to your channel/group
4. Get the `chat_id`:
   ```bash
   curl "https://api.telegram.org/bot{TOKEN}/getUpdates" | jq '.result[0].message.chat.id'
   ```

For a personal chat (not a group), the `chat_id` is your numeric user ID. For channels, it's the channel ID (starts with `-100`).

### Configuration

```toml
[[notify.channels]]
name         = "telegram"
type         = "telegram"
bot_token    = "123456789:ABCDEFxxxxxxxxxxxxxxxxxxxxxxx"
chat_id      = "-1001234567890"
# parse_mode = "HTML"   # optional: "HTML" | "Markdown" | "MarkdownV2"
```

With HTML parse mode, messages can include formatting:

```toml
[[actions]]
type    = "notify"
channel = "telegram"
message = "<b>Alert!</b> Front door opened at <code>07:30</code>"
title   = "Security"
```

### Testing

```bash
curl -s -X POST http://localhost:8080/api/v1/notify/test \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"channel": "telegram", "message": "Test from HomeCore"}'
```

## Pushover

### Configuration

```toml
[[notify.channels]]
name      = "pushover"
type      = "pushover"
api_key   = "your-pushover-application-key"   # from pushover.net app registration
user_key  = "your-pushover-user-key"           # from your account dashboard
# device  = ""      # optional: specific device name, or omit for all devices
# sound   = ""      # optional: sound name override
# priority = 0      # optional: -2 (silent) to 2 (emergency)
```

### Multiple Pushover channels

Use separate channel entries for different priorities or users:

```toml
[[notify.channels]]
name     = "pushover-normal"
type     = "pushover"
api_key  = "app-key"
user_key = "your-user-key"
priority = 0

[[notify.channels]]
name     = "pushover-urgent"
type     = "pushover"
api_key  = "app-key"
user_key = "your-user-key"
priority = 1      # high priority — bypasses quiet hours
```

## Email

### Configuration

```toml
[[notify.channels]]
name = "email-alerts"
type = "email"
from = "homecore@yourdomain.com"
to   = ["you@yourdomain.com"]

[notify.channels.smtp]
host     = "smtp.yourdomain.com"
port     = 587
username = "homecore@yourdomain.com"
password = "app-password"
starttls = true     # STARTTLS upgrade (port 587)
# tls    = true     # Direct TLS (port 465)
```

### Gmail example

Use an [App Password](https://support.google.com/accounts/answer/185833), not your account password:

```toml
[notify.channels.smtp]
host     = "smtp.gmail.com"
port     = 587
username = "youraddress@gmail.com"
password = "xxxx-xxxx-xxxx-xxxx"   # 16-char app password
starttls = true
```

### Troubleshooting

Common email failures and fixes:

| Error | Likely cause |
|---|---|
| `Connection refused` | Wrong SMTP host or port |
| `Authentication failed` | Wrong username/password; try an app password |
| `TLS handshake failed` | Use `starttls = true` for port 587, or `tls = true` for port 465 |
| `Relay denied` | SMTP server requires authentication; check username/password |

Test email delivery:

```bash
curl -s -X POST http://localhost:8080/api/v1/notify/test \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"channel": "email-alerts", "message": "Test alert from HomeCore", "title": "Test"}'
```

## Worked example — door left open for 10 minutes

```toml
id       = ""
name     = "Garage — left open alert"
enabled  = true
priority = 10
cooldown_secs = 600   # alert at most once per 10 minutes

[trigger]
type       = "cron"
expression = "0 * * * * *"   # every minute

[[conditions]]
type      = "device_state"
device_id = "yolink_garage_door"
attribute = "open"
op        = "Eq"
value     = true

[[conditions]]
type          = "time_elapsed"
device_id     = "yolink_garage_door"
attribute     = "open"
duration_secs = 600

[[actions]]
type = "parallel"

[[actions.actions]]
type    = "notify"
channel = "telegram"
message = "Garage door has been open for 10+ minutes!"
title   = "Garage Alert"

[[actions.actions]]
type    = "notify"
channel = "pushover-urgent"
message = "Garage door has been open for 10+ minutes!"
```

## Worked example — multi-channel temperature alert

```toml
id       = ""
name     = "Temperature — high alert"
enabled  = true
cooldown_secs = 3600   # once per hour max

[trigger]
type      = "device_state_changed"
device_id = "sensor_basement_temp"
attribute = "temperature"

[[conditions]]
type      = "device_state"
device_id = "sensor_basement_temp"
attribute = "temperature"
op        = "Gt"
value     = 85

[[actions]]
type = "parallel"

[[actions.actions]]
type    = "notify"
channel = "telegram"
message = "Basement temperature is {{device.temperature}}°F — check the HVAC!"
title   = "Temperature Alert"

[[actions.actions]]
type    = "notify"
channel = "email-alerts"
message = "Basement temperature alert: {{device.temperature}}°F"
title   = "HomeCore Temperature Alert"
```

# oc-notify

[![npm version](https://img.shields.io/npm/v/oc-notify.svg)](https://www.npmjs.com/package/oc-notify)
[![license](https://img.shields.io/npm/l/oc-notify.svg)](https://github.com/adrianfilitos/oc-notify/blob/main/LICENSE)

Push notifications for **OpenCode** permission requests, with **Allow / Always / Deny** buttons on your phone.

OpenCode stops and waits when an agent needs permission to run a command or touch a file. If you are not at the keyboard, nothing moves. `oc-notify` watches the local OpenCode server and sends you a push through [ntfy](https://ntfy.sh). You answer from the notification and the agent keeps going.

```
OpenCode needs permission
  run: npm install
  [Allow once] [Always] [Deny]
```

## Requirements

- Node.js 20 or newer.
- OpenCode running locally (it writes `service.json` when it starts).
- The ntfy app on your phone ([iOS](https://apps.apple.com/app/ntfy/id1625396347) / [Android](https://play.google.com/store/apps/details?id=io.heckel.ntfy)) or any ntfy client.

## Install

```bash
npm install -g oc-notify
```

Or run it without installing:

```bash
npx oc-notify
```

## Quick start

```bash
oc-notify
```

The first run creates a config file and prints two random topics:

```
config:      C:\Users\you\AppData\Roaming\oc-notify\config.json
ntfy server: https://ntfy.sh
push topic:  oc-k3x9...
reply topic: oc-res-p2m7...
```

1. Install the ntfy app and subscribe to the **push topic**.
2. Leave `oc-notify` running while you work.
3. Start a task in OpenCode. When a permission shows up, you get a notification with three actions.

Send a test notification at any time:

```bash
oc-notify --test
```

## Commands

| Command | What it does |
| --- | --- |
| `oc-notify` | Watch permission requests until you press Ctrl+C |
| `oc-notify --once` | Check once and exit |
| `oc-notify --test` | Send a test notification |
| `oc-notify --verbose` | Log every polling cycle |

| Option | Default | Description |
| --- | --- | --- |
| `--topic <name>` | random | ntfy topic for notifications (saved to config) |
| `--reply-topic <name>` | random | ntfy topic that receives the button replies (saved) |
| `--server <url>` | `https://ntfy.sh` | ntfy server |
| `--token <token>` | none | ntfy access token, for protected topics (saved) |
| `--service <path>` | auto | Path to OpenCode `service.json` |
| `--interval <ms>` | `3000` | Poll interval, minimum 1000 |
| `--no-actions` | off | Send notifications without buttons |

## Config file

| OS | Path |
| --- | --- |
| Windows | `%APPDATA%\oc-notify\config.json` |
| macOS | `~/Library/Application Support/oc-notify/config.json` |
| Linux | `$XDG_CONFIG_HOME/oc-notify/config.json` or `~/.config/oc-notify/config.json` |

```json
{
  "server": "https://ntfy.sh",
  "topic": "oc-k3x9...",
  "replyTopic": "oc-res-p2m7...",
  "interval": 3000,
  "service": null,
  "token": null,
  "actions": true
}
```

Options passed on the command line are written back to this file, so you only type them once.

## Security

- **ntfy.sh topics are public.** Anyone who knows the topic can read the notifications and press the buttons. A random 12-character topic is hard to guess, but it is not a secret in the cryptographic sense.
- If your agent touches sensitive code, self-host ntfy and protect the topics with an access token (`--token`).
- `service.json` contains the OpenCode password. `oc-notify` reads it locally and only sends it to the local OpenCode URL. It is never sent to ntfy.
- Notifications include the permission message and the affected resources, and those go through your ntfy server.

## How it works

1. Reads `~/.local/state/opencode/service.json` to get the local URL and password.
2. Polls `GET /api/permission/request` every few seconds.
3. Publishes a new notification to the push topic for each request it has not seen.
4. Polls the reply topic with `GET /topic/json?poll=1&since=...`.
5. On `allow:<id>`, `always:<id>` or `deny:<id>`, calls `POST /api/session/:sessionID/permission/:requestID/reply` with `{"decision":"once"|"always"|"reject"}`.

## Troubleshooting

**`Cannot find ...service.json`**
Start OpenCode once, or pass the path with `--service`. The file lives in `~/.local/state/opencode/service.json` on every platform.

**HTTP 401**
The OpenCode password changed (the app restarted). `oc-notify` rereads the file on every start; restart it.

**No notification on the phone**
Check that the app is subscribed to the exact push topic, and that `--server` points to the same ntfy instance.

**The buttons do nothing**
`oc-notify` must be running to poll replies. Start it with `--verbose` and watch the log.

**The agent is still waiting**
The request may have been answered in another client (the OpenCode app itself). `oc-notify` ignores replies for requests that are no longer pending.

## Limitations

- The OpenCode HTTP API is not a stable public contract. Endpoints can change between versions.
- Only permission requests are covered. Task completion notifications are not included yet.
- Tested with OpenCode 2.0.30 on Windows 11 and Node.js 24.

## License

MIT

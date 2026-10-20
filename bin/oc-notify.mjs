#!/usr/bin/env node
import fs from 'node:fs';
import process from 'node:process';

import { configPath, loadConfig, saveConfig } from '../src/config.mjs';
import { publish } from '../src/ntfy.mjs';
import { watch } from '../src/watcher.mjs';

const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

function help() {
  return `oc-notify ${pkg.version}

Push notifications for OpenCode permission requests.
Approve or deny from your phone with ntfy.

Usage:
  oc-notify [options]

Options:
  --test                 Send a test notification and exit
  --once                 Check once and exit
  --topic <name>         ntfy topic for notifications (saved)
  --reply-topic <name>   ntfy topic for approve/deny replies (saved)
  --server <url>         ntfy server (default: https://ntfy.sh)
  --token <token>        ntfy access token (saved)
  --service <path>       OpenCode service.json path
  --interval <ms>        Poll interval (default: 3000)
  --no-actions           Notifications without buttons (saved)
  --verbose              Log every cycle
  -h, --help             Show this help
  -v, --version          Show the version

Config file:
  ${configPath()}

How it works:
  1. Reads the local OpenCode service.json (url and password).
  2. Polls /api/permission/request while the agent works.
  3. Sends a push to your ntfy topic for every new request.
  4. Polls the reply topic and applies Allow / Always / Deny.
`;
}

const argv = process.argv.slice(2);
const opts = { once: false, test: false, verbose: false };
const overrides = {};

function valueFor(index, name, inline) {
  if (inline !== undefined) return [inline, index];
  const value = argv[index + 1];
  if (value === undefined || value.startsWith('--')) {
    throw new Error(`${name} needs a value`);
  }
  return [value, index + 1];
}

try {
  for (let i = 0; i < argv.length; i += 1) {
    let arg = argv[i];
    let inline;

    if (arg.startsWith('--') && arg.includes('=')) {
      const at = arg.indexOf('=');
      inline = arg.slice(at + 1);
      arg = arg.slice(0, at);
    }

    switch (arg) {
      case '-h':
      case '--help':
        console.log(help());
        process.exit(0);
        break;
      case '-v':
      case '--version':
        console.log(pkg.version);
        process.exit(0);
        break;
      case '--test':
        opts.test = true;
        break;
      case '--once':
        opts.once = true;
        break;
      case '--verbose':
        opts.verbose = true;
        break;
      case '--no-actions':
        overrides.actions = false;
        break;
      case '--topic': {
        const [value, next] = valueFor(i, arg, inline);
        overrides.topic = value;
        i = next;
        break;
      }
      case '--reply-topic': {
        const [value, next] = valueFor(i, arg, inline);
        overrides.replyTopic = value;
        i = next;
        break;
      }
      case '--server': {
        const [value, next] = valueFor(i, arg, inline);
        overrides.server = value;
        i = next;
        break;
      }
      case '--token': {
        const [value, next] = valueFor(i, arg, inline);
        overrides.token = value;
        i = next;
        break;
      }
      case '--service': {
        const [value, next] = valueFor(i, arg, inline);
        overrides.service = value;
        i = next;
        break;
      }
      case '--interval': {
        const [value, next] = valueFor(i, arg, inline);
        const ms = Number(value);
        if (!Number.isFinite(ms) || ms < 1000) {
          throw new Error('--interval must be a number of milliseconds, 1000 or more');
        }
        overrides.interval = ms;
        i = next;
        break;
      }
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }
} catch (err) {
  console.error(`\n${err.message}\n`);
  console.error(help());
  process.exit(1);
}

const file = configPath();
const cfg = { ...loadConfig(file), ...overrides };
if (Object.keys(overrides).length) saveConfig(cfg, file);

if (!/^https?:\/\//.test(cfg.server)) {
  console.error('--server must start with http:// or https://');
  process.exit(1);
}

const log = opts.verbose ? console.log : () => {};

console.log(`config:      ${file}`);
console.log(`ntfy server: ${cfg.server}`);
console.log(`push topic:  ${cfg.topic}`);
console.log(`reply topic: ${cfg.replyTopic}`);
console.log('');
console.log('On your phone: install the ntfy app and subscribe to the push topic.');
console.log('The reply topic receives the Allow / Always / Deny buttons.');
if (cfg.server.startsWith('https://ntfy.sh') && !cfg.token) {
  console.log('');
  console.log('Note: ntfy.sh topics are public. Use long random topics or a self-hosted');
  console.log('server with an access token if this machine handles sensitive work.');
}
console.log('');

if (opts.test) {
  try {
    await publish(cfg, {
      title: 'oc-notify',
      message: 'Test notification. If you can read this, ntfy works.',
      priority: 'high',
      tags: ['white_check_mark'],
    });
    console.log('Test notification sent.');
  } catch (err) {
    console.error(`Could not send the test notification: ${err.message}`);
    process.exit(1);
  }
  process.exit(0);
}

const controller = new AbortController();
process.on('SIGINT', () => {
  controller.abort();
  console.log('\nStopped.');
  process.exit(0);
});

try {
  await watch(cfg, {
    signal: controller.signal,
    once: opts.once,
    actions: cfg.actions !== false,
    log,
  });
} catch (err) {
  console.error(`\nError: ${err.message}`);
  process.exit(1);
}

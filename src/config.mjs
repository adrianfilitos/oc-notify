import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

export function configDir(platform = process.platform, env = process.env, home = os.homedir()) {
  if (platform === 'win32') {
    const base = env.APPDATA || path.join(home, 'AppData', 'Roaming');
    return path.join(base, 'oc-notify');
  }
  if (platform === 'darwin') {
    return path.join(home, 'Library', 'Application Support', 'oc-notify');
  }
  const base = env.XDG_CONFIG_HOME || path.join(home, '.config');
  return path.join(base, 'oc-notify');
}

export function configPath() {
  return path.join(configDir(), 'config.json');
}

export function randomTopic(prefix = 'oc') {
  let out = '';
  for (let i = 0; i < 12; i += 1) {
    out += ALPHABET[crypto.randomInt(ALPHABET.length)];
  }
  return `${prefix}-${out}`;
}

export function defaultConfig() {
  return {
    server: 'https://ntfy.sh',
    topic: randomTopic('oc'),
    replyTopic: randomTopic('oc-res'),
    interval: 3000,
    service: null,
    token: null,
    actions: true,
  };
}

export function loadConfig(file = configPath()) {
  let stored = {};
  const exists = fs.existsSync(file);
  if (exists) {
    stored = JSON.parse(fs.readFileSync(file, 'utf8'));
  }

  // Keep a stable topic pair: generate once, then reuse it forever.
  const cfg = {
    server: stored.server ?? 'https://ntfy.sh',
    topic: stored.topic ?? randomTopic('oc'),
    replyTopic: stored.replyTopic ?? randomTopic('oc-res'),
    interval: stored.interval ?? 3000,
    service: stored.service ?? null,
    token: stored.token ?? null,
    actions: stored.actions ?? true,
  };

  if (!exists || !stored.topic || !stored.replyTopic) {
    saveConfig(cfg, file);
  }
  return cfg;
}

export function saveConfig(cfg, file = configPath()) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(cfg, null, 2)}\n`, 'utf8');
}

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { configDir, loadConfig, randomTopic, saveConfig } from '../src/config.mjs';

test('configDir follows the platform conventions', () => {
  assert.equal(
    configDir('win32', { APPDATA: 'C:\\Users\\x\\AppData\\Roaming' }, 'C:\\Users\\x'),
    path.join('C:\\Users\\x\\AppData\\Roaming', 'oc-notify')
  );
  assert.equal(
    configDir('darwin', {}, '/Users/x'),
    path.join('/Users/x', 'Library', 'Application Support', 'oc-notify')
  );
  assert.equal(
    configDir('linux', { XDG_CONFIG_HOME: '/home/x/.config' }, '/home/x'),
    path.join('/home/x/.config', 'oc-notify')
  );
  assert.equal(configDir('linux', {}, '/home/x'), path.join('/home/x/.config', 'oc-notify'));
});

test('randomTopic uses the prefix and a safe alphabet', () => {
  const topic = randomTopic('oc');
  assert.match(topic, /^oc-[a-z0-9]{12}$/);
  assert.notEqual(topic, randomTopic('oc'));
});

test('loadConfig creates the file once and keeps the topics stable', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oc-notify-'));
  const file = path.join(dir, 'config.json');

  const first = loadConfig(file);
  assert.equal(fs.existsSync(file), true);
  assert.match(first.topic, /^oc-[a-z0-9]{12}$/);

  const second = loadConfig(file);
  assert.equal(second.topic, first.topic);
  assert.equal(second.replyTopic, first.replyTopic);
  assert.equal(second.server, 'https://ntfy.sh');
});

test('saveConfig writes valid JSON', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oc-notify-'));
  const file = path.join(dir, 'nested', 'config.json');
  const cfg = loadConfig(file);

  saveConfig({ ...cfg, interval: 5000 }, file);

  const stored = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(stored.interval, 5000);
  assert.equal(stored.topic, cfg.topic);
});

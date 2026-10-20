import { pendingPermissions, readService, replyPermission } from './opencode.mjs';
import { pollReplies, publish } from './ntfy.mjs';
import { parseReply } from './replies.mjs';

function sleep(ms, signal) {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true }
    );
  });
}

function replyUrl(cfg) {
  return `${cfg.server.replace(/\/+$/, '')}/${encodeURIComponent(cfg.replyTopic)}`;
}

export async function watch(cfg, { service, once = false, actions = true, log = console.log, signal } = {}) {
  const svc = readService(service ?? cfg.service ?? undefined);
  const known = new Map();
  const notified = new Set();
  const seenMessages = new Set();
  let since = Math.floor(Date.now() / 1000) - 5;
  let stopped = false;

  signal?.addEventListener('abort', () => {
    stopped = true;
  });

  const notify = async (req) => {
    const what = req.message?.trim() || req.action || 'permission requested';
    const lines = [what];
    if (req.resources?.length) lines.push(req.resources.join(', '));

    const buttons =
      actions && cfg.actions !== false
        ? [
            { label: 'Allow once', url: replyUrl(cfg), body: `allow:${req.id}`, clear: true },
            { label: 'Always', url: replyUrl(cfg), body: `always:${req.id}`, clear: true },
            { label: 'Deny', url: replyUrl(cfg), body: `deny:${req.id}`, clear: true },
          ]
        : [];

    await publish(cfg, {
      title: 'OpenCode: permission needed',
      message: lines.join('\n'),
      priority: 'high',
      tags: ['lock'],
      actions: buttons,
    });

    notified.add(req.id);
    if (notified.size > 500) {
      notified.delete(notified.values().next().value);
    }
    log(`notified ${req.id}: ${what}`);
  };

  const handleReplies = async () => {
    const messages = await pollReplies(cfg, since);
    for (const msg of messages) {
      if (msg.id && seenMessages.has(msg.id)) continue;
      if (msg.id) {
        seenMessages.add(msg.id);
        if (seenMessages.size > 500) seenMessages.delete(seenMessages.values().next().value);
      }
      since = Math.max(since, Number(msg.time) || since);

      const parsed = parseReply(msg.message);
      if (!parsed) continue;

      const req = known.get(parsed.requestID);
      if (!req) {
        log(`ignored reply for ${parsed.requestID} (not pending anymore)`);
        continue;
      }

      await replyPermission(svc, req.sessionID, parsed.requestID, parsed.decision);
      known.delete(parsed.requestID);
      log(`replied ${parsed.decision} to ${parsed.requestID}`);
    }
  };

  const cycle = async () => {
    const current = await pendingPermissions(svc);
    const currentIds = new Set(current.map((req) => req.id));

    for (const req of current) {
      known.set(req.id, req);
      if (!notified.has(req.id)) await notify(req);
    }

    for (const id of [...known.keys()]) {
      if (!currentIds.has(id)) known.delete(id);
    }

    if (actions && cfg.actions !== false) await handleReplies();
  };

  log(`watching ${svc.url}`);
  log(`push topic:  ${cfg.topic}`);
  log(`reply topic: ${cfg.replyTopic}`);
  log(`server:      ${cfg.server}`);

  if (once) {
    await cycle();
    return;
  }

  while (!stopped) {
    try {
      await cycle();
    } catch (err) {
      log(`error: ${err.message}`);
    }
    await sleep(Math.max(1000, Number(cfg.interval) || 3000), signal);
  }
}

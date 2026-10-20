import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export function defaultServicePath(home = os.homedir()) {
  return path.join(home, '.local', 'state', 'opencode', 'service.json');
}

/**
 * service.json usually binds 0.0.0.0, which is not a connectable address on
 * every platform. Talk to loopback instead.
 */
export function normalizeUrl(url) {
  return url.replace('//0.0.0.0', '//127.0.0.1');
}

export function readService(file = defaultServicePath()) {
  if (!fs.existsSync(file)) {
    throw new Error(`Cannot find ${file}. Start OpenCode once, or pass --service <path>.`);
  }
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!raw.url || !raw.password) {
    throw new Error(`${file} has no url or password.`);
  }
  return {
    url: normalizeUrl(raw.url).replace(/\/+$/, ''),
    password: raw.password,
    version: raw.version ?? null,
  };
}

function auth(password) {
  return `Basic ${Buffer.from(`opencode:${password}`).toString('base64')}`;
}

export async function request(svc, pathname, init = {}) {
  const res = await fetch(`${svc.url}${pathname}`, {
    ...init,
    headers: {
      Authorization: auth(svc.password),
      ...(init.headers ?? {}),
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`${pathname} HTTP ${res.status}${body ? `: ${body.slice(0, 160)}` : ''}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export async function pendingPermissions(svc) {
  const json = await request(svc, '/api/permission/request');
  const list = json?.data ?? json;
  return Array.isArray(list) ? list : [];
}

export async function replyPermission(svc, sessionID, requestID, decision) {
  if (!['once', 'always', 'reject'].includes(decision)) {
    throw new Error(`Invalid decision: ${decision}`);
  }
  return request(
    svc,
    `/api/session/${encodeURIComponent(sessionID)}/permission/${encodeURIComponent(requestID)}/reply`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision }),
    }
  );
}

function baseUrl(cfg) {
  return cfg.server.replace(/\/+$/, '');
}

function authHeaders(cfg) {
  return cfg.token ? { Authorization: `Bearer ${cfg.token}` } : {};
}

function actionString(action) {
  return [
    'http',
    action.label,
    action.url,
    `method=${action.method ?? 'POST'}`,
    action.body ? `body=${action.body}` : '',
    action.clear ? 'clear=true' : '',
  ]
    .filter(Boolean)
    .join(', ');
}

export async function publish(cfg, { title, message, priority = 'default', tags = [], actions = [] }) {
  const headers = {
    'Content-Type': 'text/plain; charset=utf-8',
    ...authHeaders(cfg),
  };
  if (title) headers['X-Title'] = title;
  if (priority) headers['X-Priority'] = priority;
  if (tags.length) headers['X-Tags'] = tags.join(',');
  if (actions.length) headers['X-Actions'] = actions.map(actionString).join('; ');

  const res = await fetch(`${baseUrl(cfg)}/${encodeURIComponent(cfg.topic)}`, {
    method: 'POST',
    headers,
    body: message,
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`ntfy HTTP ${res.status}${body ? `: ${body.slice(0, 160)}` : ''}`);
  }
  return res.json().catch(() => ({}));
}

/**
 * Read messages posted to the reply topic since `since` (a Unix timestamp).
 * Returns ntfy message objects only.
 */
export async function pollReplies(cfg, since) {
  const url = `${baseUrl(cfg)}/${encodeURIComponent(cfg.replyTopic)}/json?poll=1&since=${since}`;
  const res = await fetch(url, {
    headers: authHeaders(cfg),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    throw new Error(`ntfy HTTP ${res.status} while polling replies`);
  }
  const text = await res.text();
  return text
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter((msg) => msg && msg.event === 'message');
}

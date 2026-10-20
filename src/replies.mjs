const DECISIONS = {
  allow: 'once',
  once: 'once',
  always: 'always',
  deny: 'reject',
  reject: 'reject',
};

/**
 * Parse a reply posted to the ntfy reply topic.
 * Accepted bodies: "allow:<requestID>", "always:<requestID>", "deny:<requestID>".
 */
export function parseReply(body) {
  if (typeof body !== 'string') return null;
  const match = body.trim().match(/^([a-z]+):([0-9a-zA-Z_-]+)$/);
  if (!match) return null;
  const decision = DECISIONS[match[1].toLowerCase()];
  if (!decision) return null;
  return { decision, requestID: match[2] };
}

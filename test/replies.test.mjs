import assert from 'node:assert/strict';
import test from 'node:test';

import { parseReply } from '../src/replies.mjs';

test('parses allow, always and deny', () => {
  assert.deepEqual(parseReply('allow:abc-123'), { decision: 'once', requestID: 'abc-123' });
  assert.deepEqual(parseReply('always:abc-123'), { decision: 'always', requestID: 'abc-123' });
  assert.deepEqual(parseReply('deny:abc-123'), { decision: 'reject', requestID: 'abc-123' });
  assert.deepEqual(parseReply('  reject:abc  '), { decision: 'reject', requestID: 'abc' });
});

test('ignores anything else', () => {
  assert.equal(parseReply('hello'), null);
  assert.equal(parseReply('allow:'), null);
  assert.equal(parseReply('allow:abc:def'), null);
  assert.equal(parseReply('allow:abc def'), null);
  assert.equal(parseReply(''), null);
  assert.equal(parseReply(null), null);
});

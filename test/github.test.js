import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openTasks } from '../src/github.js';

test('rejects invalid repositories before making requests', async () => {
  for (const value of [undefined, '', 'https://example.com/x', '../x', 'owner/..', 'owner/repo?token=x', 'a/b/c']) {
    await assert.rejects(openTasks(value, () => { throw new Error('must not call'); }), /repository|Invalid/);
  }
});

test('uses the public GitHub endpoint without credentials or local data', async () => {
  const result = await openTasks('octocat/Hello-World', async (url, options) => {
    assert.match(url, /^https:\/\/api.github.com\/repos\/octocat\/Hello-World\/issues\?/);
    assert.equal(options.headers.Authorization, undefined);
    assert.equal(options.body, undefined);
    assert.equal(options.redirect, 'error');
    assert.ok(options.signal instanceof AbortSignal);
    return { ok: true, json: async () => [{ number: 4, title: 'Write docs' }] };
  });
  assert.deepEqual(result, [{ number: 4, title: 'Write docs', url: 'https://github.com/octocat/Hello-World/issues/4' }]);
});

test('filters pull requests and limits issue output to ten', async () => {
  const issues = Array.from({ length: 15 }, (_, i) => ({ number: i + 1, title: 'Task' }));
  const result = await openTasks('o/r', async () => ({ ok: true, json: async () => [{ number: 99, title: 'PR', pull_request: {} }, ...issues] }));
  assert.equal(result.length, 10);
  assert.equal(result[0].number, 1);
});

test('sanitizes terminal controls and constructs trusted issue links', async () => {
  const result = await openTasks('o/r', async () => ({ ok: true, json: async () => [{ number: 2, title: '\x1b[2J\nTask\u202e', html_url: 'https://evil.invalid' }] }));
  assert.doesNotMatch(result[0].title, /[\x00-\x1f\u202e]/);
  assert.equal(result[0].url, 'https://github.com/o/r/issues/2');
});

test('handles missing repositories, rate limits and server errors', async () => {
  for (const [status, pattern] of [[404, /not found/], [403, /rate-limited/], [429, /rate-limited/], [500, /HTTP 500/]]) {
    await assert.rejects(openTasks('o/r', async () => ({ ok: false, status })), pattern);
  }
});

test('handles offline and malformed responses', async () => {
  await assert.rejects(openTasks('o/r', async () => { throw new Error('offline'); }), /reach GitHub/);
  await assert.rejects(openTasks('o/r', async () => ({ ok: true, json: async () => { throw new Error(); } })), /unreadable/);
  await assert.rejects(openTasks('o/r', async () => ({ ok: true, json: async () => ({}) })), /unexpected/);
  await assert.rejects(openTasks('o/r', async () => ({ ok: true, json: async () => [{ number: -1, title: 'Invalid' }] })), /invalid issue/);
});

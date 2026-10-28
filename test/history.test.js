import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseHistoryOptions, selectHistory } from '../src/history.js';

const sessions = [
  { id: 'late', completedAt: '2026-10-28T23:59:59.999Z', minutes: 25, label: 'Read\u202e' },
  { id: 'early', completedAt: '2026-10-27T00:00:00.000Z', minutes: 10, label: 'Write' },
  { id: 'middle', completedAt: '2026-10-28T00:00:00.000Z', minutes: 15, label: 'Ders çalış' },
  { id: 'next', completedAt: '2026-10-29T00:00:00.000Z', minutes: 30, label: 'Learn' }
];

test('history sorts chronologically without mutating stored or input order', () => {
  const original = sessions.map(session => session.id);
  assert.deepEqual(selectHistory(sessions).map(session => session.id), ['early', 'middle', 'late', 'next']);
  assert.deepEqual(sessions.map(session => session.id), original);
});

test('date filters include both boundaries of a whole UTC day', () => {
  const options = parseHistoryOptions(['--since', '2026-10-28', '--until', '2026-10-28']);
  assert.deepEqual(selectHistory(sessions, options).map(session => session.id), ['middle', 'late']);
});

test('limit applies after date filtering and keeps newest matches in chronological order', () => {
  const options = parseHistoryOptions(['--until', '2026-10-28', '--limit', '2', '--json']);
  assert.equal(options.json, true);
  assert.deepEqual(selectHistory(sessions, options).map(session => session.id), ['middle', 'late']);
  assert.deepEqual(selectHistory([], options), []);
});

test('validates calendar dates and accepts real leap days', () => {
  assert.equal(parseHistoryOptions(['--since', '2024-02-29']).since, '2024-02-29');
  for (const args of [['--since', '2026-02-29'], ['--until', '2026-04-31'], ['--since', '2026-1-1'], ['--since', '2026-10-29', '--until', '2026-10-28']]) assert.throws(() => parseHistoryOptions(args));
});

test('rejects unknown, repeated, incomplete and unbounded options', () => {
  for (const args of [['--json', '--json'], ['--since'], ['--since', '--json'], ['--limit', '0'], ['--limit', '-1'], ['--limit', '2.5'], ['--limit', '10001'], ['--limit', 'Infinity'], ['--limit', '2', '--limit', '3'], ['--unknown'], ['extra']]) assert.throws(() => parseHistoryOptions(args));
});

test('CLI filtered JSON output preserves session values without modifying journal bytes', t => {
  const dir = mkdtempSync(join(tmpdir(), 'tiny-focus-history-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = join(dir, 'sessions.jsonl');
  const original = sessions.map(session => JSON.stringify(session)).join('\n') + '\n';
  writeFileSync(file, original);
  const result = spawnSync(process.execPath, ['src/cli.js', 'history', '--since', '2026-10-28', '--limit', '2', '--json'], { env: { ...process.env, TINY_FOCUS_HOME: dir }, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout).map(session => session.id), ['late', 'next']);
  assert.equal(JSON.parse(result.stdout)[0].label, sessions[0].label);
  assert.doesNotMatch(result.stdout, /\u202e/);
  assert.equal(readFileSync(file, 'utf8'), original);
});

test('CLI JSON empty results are an empty array and invalid options fail clearly', t => {
  const dir = mkdtempSync(join(tmpdir(), 'tiny-focus-history-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const env = { ...process.env, TINY_FOCUS_HOME: dir };
  const empty = spawnSync(process.execPath, ['src/cli.js', 'history', '--json'], { env, encoding: 'utf8' });
  assert.equal(empty.status, 0, empty.stderr);
  assert.deepEqual(JSON.parse(empty.stdout), []);
  const invalid = spawnSync(process.execPath, ['src/cli.js', 'history', '--limit'], { env, encoding: 'utf8' });
  assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /Missing value/);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { minutes, recordSession, readSessions } from '../src/journal.js';

function temporary(t) {
  const directory = mkdtempSync(join(tmpdir(), 'tiny-focus-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}

test('rejects invalid and unbounded durations', () => {
  for (const value of [undefined, '', 0, -1, NaN, Infinity, 1441, 'no']) assert.throws(() => minutes(value));
  assert.equal(minutes('25'), 25);
});

test('new journal is empty and sessions survive reading', t => {
  const dir = temporary(t);
  assert.deepEqual(readSessions(dir), []);
  const first = recordSession(25, 'Read a book', dir);
  recordSession(15, 'Code', dir);
  const entries = readSessions(dir);
  assert.equal(entries.length, 2);
  assert.deepEqual(entries[0], first);
  assert.notEqual(entries[0].id, entries[1].id);
});

test('corruption reports line number without replacing journal', t => {
  const dir = temporary(t);
  writeFileSync(join(dir, 'sessions.jsonl'), 'not json\n');
  assert.throws(() => readSessions(dir), /line 1/);
});

test('CLI logs and lists a real session using isolated storage', t => {
  const dir = temporary(t);
  const env = { ...process.env, TINY_FOCUS_HOME: dir };
  const logged = spawnSync(process.execPath, ['src/cli.js', 'log', '25', 'Study'], { env, encoding: 'utf8' });
  assert.equal(logged.status, 0, logged.stderr);
  const history = spawnSync(process.execPath, ['src/cli.js', 'history'], { env, encoding: 'utf8' });
  assert.equal(history.status, 0);
  assert.match(history.stdout, /25 min.*Study/);
});

test('CLI timer records only after it finishes', t => {
  const dir = temporary(t);
  const run = spawnSync(process.execPath, ['src/cli.js', 'start', '0.001', 'Smoke'], { env: { ...process.env, TINY_FOCUS_HOME: dir }, encoding: 'utf8', timeout: 5000 });
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /Session complete/);
  assert.equal(readSessions(dir).length, 1);
});

test('CLI rejects invalid commands without writing sessions', t => {
  const dir = temporary(t);
  const run = spawnSync(process.execPath, ['src/cli.js', 'log', '-3'], { env: { ...process.env, TINY_FOCUS_HOME: dir }, encoding: 'utf8' });
  assert.equal(run.status, 1);
  assert.deepEqual(readSessions(dir), []);
});

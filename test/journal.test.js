import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
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
  for (const value of [undefined, '', 0, -1, NaN, Infinity, 1441, 'no', true, null, [], {}, '0x10', '1e2']) assert.throws(() => minutes(value));
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

test('rejects type-coerced durations, noncanonical dates, missing IDs and duplicate IDs in journals', t => {
  const dir = temporary(t);
  const valid = recordSession(25, 'Read', dir);
  for (const invalid of [
    { ...valid, minutes: '25' }, { ...valid, minutes: true },
    { ...valid, completedAt: '2026-02-30T00:00:00.000Z' },
    { ...valid, completedAt: 0 }, { ...valid, id: '' },
    { ...valid, label: 42 }, { ...valid, label: '' }, { ...valid, label: 'x'.repeat(201) }
  ]) {
    writeFileSync(join(dir, 'sessions.jsonl'), JSON.stringify(invalid) + '\n');
    assert.throws(() => readSessions(dir), /Invalid session/);
  }
  writeFileSync(join(dir, 'sessions.jsonl'), [valid, valid].map(JSON.stringify).join('\n'));
  assert.throws(() => readSessions(dir), /line 2/);
});

test('corrupt journals remain byte-for-byte unchanged when logging fails', t => {
  const dir = temporary(t);
  const file = join(dir, 'sessions.jsonl');
  const content = '\n\nnot json\n';
  writeFileSync(file, content);
  assert.throws(() => recordSession(25, 'Read', dir), /line 3/);
  assert.equal(readFileSync(file, 'utf8'), content);
});

test('appends safely when a valid last journal line has no newline', t => {
  const dir = temporary(t);
  const first = recordSession(25, 'Read', dir);
  writeFileSync(join(dir, 'sessions.jsonl'), JSON.stringify(first));
  recordSession(15, 'Write', dir);
  assert.equal(readSessions(dir).length, 2);
});

test('CLI output cannot execute label or error control sequences', t => {
  const dir = temporary(t);
  const env = { ...process.env, TINY_FOCUS_HOME: dir };
  const run = spawnSync(process.execPath, ['src/cli.js', 'log', '25', '\x1b[2JRead\u202e'], { env, encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  assert.doesNotMatch(run.stdout, /[\x1b\u202e]/);
  const invalid = spawnSync(process.execPath, ['src/cli.js', '\x1b[2J'], { env, encoding: 'utf8' });
  assert.equal(invalid.status, 1);
  assert.doesNotMatch(invalid.stderr, /\x1b/);
});

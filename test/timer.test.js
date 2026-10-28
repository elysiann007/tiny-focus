import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { runTimer } from '../src/timer.js';
import { readSessions, recordSession, preflightJournal, withJournalLock } from '../src/journal.js';

test('timer uses elapsed time rather than accumulating delayed ticks', async () => {
  let clock = 0;
  const ticks = [];
  await runTimer(0.1, { now: () => clock, wait: async () => { clock += 2500; }, onTick: seconds => ticks.push(seconds) });
  assert.deepEqual(ticks, [6, 4, 1]);
  assert.equal(clock, 7500);
});

test('an already-cancelled timer does not tick or sleep', async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(runTimer(25, { signal: controller.signal, onTick() { assert.fail('must not tick'); }, wait() { assert.fail('must not sleep'); } }), { name: 'AbortError' });
});

test('cancelling a sleeping timer aborts promptly', async () => {
  const controller = new AbortController();
  const timer = runTimer(25, { signal: controller.signal, onTick() { queueMicrotask(() => controller.abort()); } });
  await assert.rejects(timer, { name: 'AbortError' });
});

test('completed break leaves existing focus history unchanged', t => {
  const dir = mkdtempSync(join(tmpdir(), 'tiny-focus-break-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  recordSession(25, 'Study', dir);
  const before = readSessions(dir);
  const result = spawnSync(process.execPath, ['src/cli.js', 'break', '0.001'], { env: { ...process.env, TINY_FOCUS_HOME: dir }, encoding: 'utf8', timeout: 5000 });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Break complete/);
  assert.deepEqual(readSessions(dir), before);
});

test('invalid break options fail without recording focus sessions', t => {
  const dir = mkdtempSync(join(tmpdir(), 'tiny-focus-break-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const args of [['break', '-1'], ['break', '1', 'label']]) {
    const result = spawnSync(process.execPath, ['src/cli.js', ...args], { env: { ...process.env, TINY_FOCUS_HOME: dir }, encoding: 'utf8' });
    assert.equal(result.status, 1);
  }
  assert.deepEqual(readSessions(dir), []);
});

test('focus start rejects corrupt journals before beginning a long timer', t => {
  const dir = mkdtempSync(join(tmpdir(), 'tiny-focus-preflight-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = join(dir, 'sessions.jsonl');
  writeFileSync(file, 'corrupt journal\n');
  const result = spawnSync(process.execPath, ['src/cli.js', 'start', '25'], { env: { ...process.env, TINY_FOCUS_HOME: dir }, encoding: 'utf8', timeout: 3000 });
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /Invalid session/);
  assert.doesNotMatch(result.stdout, /Focusing/);
  assert.equal(readFileSync(file, 'utf8'), 'corrupt journal\n');
});

test('focus start fails immediately if another writer owns the journal lock', t => {
  const dir = mkdtempSync(join(tmpdir(), 'tiny-focus-preflight-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  withJournalLock(dir, () => {
    const result = spawnSync(process.execPath, ['src/cli.js', 'start', '25'], { env: { ...process.env, TINY_FOCUS_HOME: dir }, encoding: 'utf8', timeout: 3000 });
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /Journal is in use/);
    assert.doesNotMatch(result.stdout, /Focusing/);
  });
  assert.deepEqual(readdirSync(dir), []);
});

test('unusable data paths fail before a focus timer starts', t => {
  const dir = mkdtempSync(join(tmpdir(), 'tiny-focus-preflight-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const blocked = join(dir, 'not-a-directory');
  writeFileSync(blocked, 'keep this file');
  const result = spawnSync(process.execPath, ['src/cli.js', 'start', '25'], { env: { ...process.env, TINY_FOCUS_HOME: blocked }, encoding: 'utf8', timeout: 3000 });
  assert.equal(result.status, 1, result.stderr);
  assert.doesNotMatch(result.stdout, /Focusing/);
  assert.equal(readFileSync(blocked, 'utf8'), 'keep this file');
});

test('preflight releases its lock and never creates a session journal', t => {
  const dir = mkdtempSync(join(tmpdir(), 'tiny-focus-preflight-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  assert.deepEqual(preflightJournal(dir), { sessions: 0 });
  assert.deepEqual(readdirSync(dir), []);
  recordSession(25, 'Read', dir);
  const before = readFileSync(join(dir, 'sessions.jsonl'));
  assert.deepEqual(preflightJournal(dir), { sessions: 1 });
  assert.deepEqual(readFileSync(join(dir, 'sessions.jsonl')), before);
});

test('breaks remain available when the focus journal is corrupt or busy', t => {
  const dir = mkdtempSync(join(tmpdir(), 'tiny-focus-preflight-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = join(dir, 'sessions.jsonl');
  writeFileSync(file, 'bad journal\n');
  withJournalLock(dir, () => {
    const result = spawnSync(process.execPath, ['src/cli.js', 'break', '0.001'], { env: { ...process.env, TINY_FOCUS_HOME: dir }, encoding: 'utf8', timeout: 3000 });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Break complete/);
  });
  assert.equal(readFileSync(file, 'utf8'), 'bad journal\n');
});

test('focus timers accept the same normalized label length as manual logging', t => {
  const dir = mkdtempSync(join(tmpdir(), 'tiny-focus-label-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const label = '  ' + 'x'.repeat(200) + '  ';
  const env = { ...process.env, TINY_FOCUS_HOME: dir };
  const logged = spawnSync(process.execPath, ['src/cli.js', 'log', '0.001', label], { env, encoding: 'utf8', timeout: 5000 });
  assert.equal(logged.status, 0, logged.stderr);
  const timed = spawnSync(process.execPath, ['src/cli.js', 'start', '0.001', label], { env, encoding: 'utf8', timeout: 5000 });
  assert.equal(timed.status, 0, timed.stderr);
  const entries = readSessions(dir);
  assert.equal(entries.length, 2);
  assert.equal(entries[0].label, 'x'.repeat(200));
  assert.equal(entries[1].label, entries[0].label);
});

test('whitespace-only focus labels display and save the same default', t => {
  const dir = mkdtempSync(join(tmpdir(), 'tiny-focus-label-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const result = spawnSync(process.execPath, ['src/cli.js', 'start', '0.001', '   '], { env: { ...process.env, TINY_FOCUS_HOME: dir }, encoding: 'utf8', timeout: 5000 });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Focusing: Focus \(/);
  assert.equal(readSessions(dir)[0].label, 'Focus');
});

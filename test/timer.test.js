import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { runTimer } from '../src/timer.js';
import { readSessions, recordSession } from '../src/journal.js';

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

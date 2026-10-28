import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { dailyStats, toCsv } from '../src/reports.js';
import { recordSession } from '../src/journal.js';

test('aggregates sessions into sorted UTC days', () => {
  assert.deepEqual(dailyStats([
    { completedAt: '2026-10-28T12:00:00Z', minutes: 25 },
    { completedAt: '2026-10-27T12:00:00Z', minutes: 15 },
    { completedAt: '2026-10-28T01:00:00+03:00', minutes: 10 }
  ]), [
    { date: '2026-10-27', sessions: 2, minutes: 25 },
    { date: '2026-10-28', sessions: 1, minutes: 25 }
  ]);
});

test('handles empty reports', () => {
  assert.deepEqual(dailyStats([]), []);
  assert.equal(toCsv([]), 'completed_at,minutes,label\r\n');
});

test('CSV quotes commas, quotes and newlines', () => {
  const csv = toCsv([{ completedAt: '2026-10-28T00:00:00Z', minutes: 25, label: 'Read, "learn"\nrepeat' }]);
  assert.match(csv, /"Read, ""learn""\nrepeat"/);
});

test('CSV neutralizes formula-like labels', () => {
  for (const label of ['=1+1', '+SUM(A1)', '-1', '@data', '  =1', '\tformula']) {
    const csv = toCsv([{ completedAt: '2026-10-28T00:00:00Z', minutes: 25, label }]);
    assert.ok(csv.includes(',"\'' + label + '"'));
  }
});

test('CLI statistics and export reflect persisted sessions', t => {
  const dir = mkdtempSync(join(tmpdir(), 'tiny-focus-report-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  recordSession(25, 'Reading', dir);
  recordSession(10, 'Writing', dir);
  const env = { ...process.env, TINY_FOCUS_HOME: dir };
  const stats = spawnSync(process.execPath, ['src/cli.js', 'stats'], { env, encoding: 'utf8' });
  assert.equal(stats.status, 0, stats.stderr);
  assert.match(stats.stdout, /2  35/);
  const exported = spawnSync(process.execPath, ['src/cli.js', 'export'], { env, encoding: 'utf8' });
  assert.equal(exported.status, 0, exported.stderr);
  assert.equal(exported.stdout.trim().split('\r\n').length, 3);
  assert.match(exported.stdout, /Reading/);
  assert.match(exported.stdout, /Writing/);
});

test('Istanbul local midnight differs from UTC grouping', () => {
  const sessions = [
    { completedAt: '2026-10-27T20:59:59.000Z', minutes: 10 },
    { completedAt: '2026-10-27T21:00:00.000Z', minutes: 15 }
  ];
  assert.deepEqual(dailyStats(sessions, 'Europe/Istanbul'), [
    { date: '2026-10-27', sessions: 1, minutes: 10 },
    { date: '2026-10-28', sessions: 1, minutes: 15 }
  ]);
  assert.equal(dailyStats(sessions).length, 1);
});

test('spring daylight saving transition stays on the correct local day', () => {
  const sessions = [
    { completedAt: '2026-03-08T04:59:00.000Z', minutes: 10 },
    { completedAt: '2026-03-08T05:01:00.000Z', minutes: 15 },
    { completedAt: '2026-03-08T07:01:00.000Z', minutes: 20 }
  ];
  assert.deepEqual(dailyStats(sessions, 'America/New_York'), [
    { date: '2026-03-07', sessions: 1, minutes: 10 },
    { date: '2026-03-08', sessions: 2, minutes: 35 }
  ]);
});

test('repeated hour at end of daylight saving counts both sessions once', () => {
  assert.deepEqual(dailyStats([
    { completedAt: '2026-11-01T05:30:00.000Z', minutes: 25 },
    { completedAt: '2026-11-01T06:30:00.000Z', minutes: 25 }
  ], 'America/New_York'), [{ date: '2026-11-01', sessions: 2, minutes: 50 }]);
});

test('invalid time zones are rejected even for an empty journal', () => {
  for (const timeZone of ['', 'Mars/Olympus', '+03:00', '--json', null]) assert.throws(() => dailyStats([], timeZone), /time zone/);
});

test('CLI accepts explicit time zone and rejects incomplete or extra options', t => {
  const dir = mkdtempSync(join(tmpdir(), 'tiny-focus-timezone-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  recordSession(25, 'Read', dir);
  const env = { ...process.env, TINY_FOCUS_HOME: dir };
  const result = spawnSync(process.execPath, ['src/cli.js', 'stats', '--timezone', 'Europe/Istanbul'], { env, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Europe\/Istanbul/);
  for (const args of [['stats', '--timezone'], ['stats', 'Europe/Istanbul'], ['stats', '--timezone', 'UTC', 'extra'], ['stats', '--timezone', 'Mars/Olympus']]) {
    const invalid = spawnSync(process.execPath, ['src/cli.js', ...args], { env, encoding: 'utf8' });
    assert.equal(invalid.status, 1);
  }
});

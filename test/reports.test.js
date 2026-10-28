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

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { focusSummary, parseSummaryOptions } from '../src/summary.js';

const sessions = [
  { id: 'one', completedAt: '2026-10-27T20:59:00.000Z', minutes: 25, label: 'Read' },
  { id: 'two', completedAt: '2026-10-27T21:01:00.000Z', minutes: 15, label: 'Read' },
  { id: 'three', completedAt: '2026-10-28T12:00:00.000Z', minutes: 20, label: 'Write' }
];

test('summary computes totals, averages, calendar days and per-label ranking', () => {
  assert.deepEqual(focusSummary(sessions), {
    timeZone: 'UTC', sessions: 3, totalMinutes: 60, averageSessionMinutes: 20,
    activeDays: 2, firstDay: '2026-10-27', lastDay: '2026-10-28',
    byLabel: [{ label: 'Read', sessions: 2, minutes: 40 }, { label: 'Write', sessions: 1, minutes: 20 }]
  });
});

test('empty and filtered-out summaries return finite zeros and null dates', () => {
  for (const result of [focusSummary([]), focusSummary(sessions, { since: '2026-11-01' })]) {
    assert.equal(result.sessions, 0);
    assert.equal(result.totalMinutes, 0);
    assert.equal(result.averageSessionMinutes, 0);
    assert.equal(result.activeDays, 0);
    assert.equal(result.firstDay, null);
    assert.equal(result.lastDay, null);
    assert.deepEqual(result.byLabel, []);
  }
});

test('local day counts follow the selected zone while date filters stay UTC', () => {
  const firstTwo = sessions.slice(0, 2);
  assert.equal(focusSummary(firstTwo).activeDays, 1);
  const local = focusSummary(firstTwo, { timeZone: 'Europe/Istanbul' });
  assert.equal(local.activeDays, 2);
  assert.equal(local.lastDay, '2026-10-28');
  assert.equal(focusSummary(firstTwo, { timeZone: 'Europe/Istanbul', since: '2026-10-28' }).sessions, 0);
});

test('fractional minutes are rounded to three decimals and label ties are deterministic', () => {
  const result = focusSummary([
    { ...sessions[0], label: 'B', minutes: 0.1 },
    { ...sessions[1], label: 'A', minutes: 0.1 },
    { ...sessions[2], label: 'A', minutes: 0.2 }
  ]);
  assert.equal(result.totalMinutes, 0.4);
  assert.equal(result.averageSessionMinutes, 0.133);
  assert.equal(result.byLabel[0].minutes, 0.3);
  const tie = focusSummary([{ ...sessions[0], label: 'B' }, { ...sessions[0], label: 'A' }]);
  assert.deepEqual(tie.byLabel.map(entry => entry.label), ['A', 'B']);
  const precise = focusSummary([{ ...sessions[0], label: 'Z', minutes: 0.1004 }, { ...sessions[1], label: 'A', minutes: 0.1003 }]);
  assert.deepEqual(precise.byLabel.map(entry => entry.label), ['Z', 'A']);
});

test('summary parser handles combined options and rejects missing, duplicate or unsupported flags', () => {
  const options = parseSummaryOptions(['--json', '--since', '2026-10-27', '--timezone', 'Europe/Istanbul']);
  assert.equal(options.json, true);
  assert.equal(options.timeZone, 'Europe/Istanbul');
  assert.equal(options.since, '2026-10-27');
  for (const args of [['--timezone'], ['--timezone', '--json'], ['--timezone', 'UTC', '--timezone', 'UTC'], ['--limit', '2'], ['--wat'], ['--since', '2026-02-30'], ['--since', '--timezone', 'UTC', '2026-10-28']]) assert.throws(() => parseSummaryOptions(args));
  assert.throws(() => focusSummary([], { timeZone: 'Mars/Olympus' }), /time zone/);
});

test('CLI summary matches stored data and does not modify journal bytes', t => {
  const dir = mkdtempSync(join(tmpdir(), 'tiny-focus-summary-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = join(dir, 'sessions.jsonl');
  const content = sessions.map(session => JSON.stringify(session)).join('\n') + '\n';
  writeFileSync(file, content);
  const env = { ...process.env, TINY_FOCUS_HOME: dir };
  const result = spawnSync(process.execPath, ['src/cli.js', 'summary', '--json', '--since', '2026-10-28'], { env, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).totalMinutes, 20);
  const text = spawnSync(process.execPath, ['src/cli.js', 'summary', '--timezone', 'Europe/Istanbul'], { env, encoding: 'utf8' });
  assert.equal(text.status, 0, text.stderr);
  assert.match(text.stdout, /Total minutes: 60/);
  assert.match(text.stdout, /By label/);
  assert.equal(readFileSync(file, 'utf8'), content);
});

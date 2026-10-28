import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const cli = fileURLToPath(new URL('../src/cli.js', import.meta.url));
const directory = mkdtempSync(join(tmpdir(), 'tiny-focus-demo-'));
const source = join(directory, 'source');
const target = join(directory, 'target');

function run(args, home = source) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd: directory,
    env: { ...process.env, TINY_FOCUS_HOME: home },
    encoding: 'utf8',
    timeout: 10_000
  });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

function show(description, output) {
  console.log(`\n${description}\n${output.trimEnd()}`);
}

try {
  const sessions = [
    { id: '00000000-0000-4000-8000-000000000001', completedAt: '2026-10-27T20:59:00.000Z', minutes: 25, label: 'Read' },
    { id: '00000000-0000-4000-8000-000000000002', completedAt: '2026-10-27T21:01:00.000Z', minutes: 15, label: 'Read' },
    { id: '00000000-0000-4000-8000-000000000003', completedAt: '2026-10-28T12:00:00.000Z', minutes: 20, label: 'Write' }
  ];
  const fixture = { format: 'tiny-focus', version: 1, createdAt: '2026-10-28T12:00:00.000Z', sessions };
  writeFileSync(join(directory, 'sample.json'), JSON.stringify(fixture));
  console.log('Tiny Focus isolated demo — sample data, not real work.');
  console.log('All journals and backup files live in a temporary directory; no network calls.');

  show('1. Restore three sample sessions:', run(['restore', 'sample.json']));
  show('2. Show the newest two sessions (history --limit 2):', run(['history', '--limit', '2']));
  show('3. Summarize in Istanbul local days:', run(['summary', '--timezone', 'Europe/Istanbul']));
  const summary = JSON.parse(run(['summary', '--timezone', 'Europe/Istanbul', '--json']));
  assert.equal(summary.sessions, 3);
  assert.equal(summary.totalMinutes, 60);
  assert.equal(summary.activeDays, 2);

  const backup = run(['backup']);
  assert.deepEqual(JSON.parse(backup).sessions, sessions);
  writeFileSync(join(directory, 'backup.json'), backup);
  show('4. Restore the backup into a separate empty journal:', run(['restore', 'backup.json'], target));
  show('5. Restore it again without duplicating sessions:', run(['restore', 'backup.json'], target));
  const restored = JSON.parse(run(['history', '--json'], target));
  assert.deepEqual(restored, sessions);
  console.log('\nDemo assertions passed. Temporary sample data will now be removed.');
} finally {
  // This directory is created by mkdtemp for this invocation only.
  rmSync(directory, { recursive: true, force: true });
}

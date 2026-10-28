import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { createBackup, createBackupText, parseBackup, restoreBackup, restoreBackupFile } from '../src/backup.js';
import { readSessions, recordSession, withJournalLock } from '../src/journal.js';

function temporary(t) {
  const dir = mkdtempSync(join(tmpdir(), 'tiny-focus-backup-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test('backup round trip preserves multilingual session data and IDs', t => {
  const source = temporary(t), target = temporary(t);
  const session = recordSession(25, 'Ders çalış — کتاب 📚', source);
  const backup = createBackup(source);
  assert.equal(backup.format, 'tiny-focus');
  assert.equal(backup.version, 1);
  assert.deepEqual(restoreBackup(JSON.stringify(backup), target), { added: 1, skipped: 0, total: 1 });
  assert.deepEqual(readSessions(target), [session]);
});

test('restore merges with existing sessions and repeated imports are idempotent', t => {
  const source = temporary(t), target = temporary(t);
  recordSession(25, 'Read', source);
  const existing = recordSession(15, 'Write', target);
  const backup = JSON.stringify(createBackup(source));
  assert.deepEqual(restoreBackup(backup, target), { added: 1, skipped: 0, total: 2 });
  assert.deepEqual(restoreBackup(backup, target), { added: 0, skipped: 1, total: 2 });
  assert.deepEqual(readSessions(target)[0], existing);
});

test('conflicting IDs leave the existing journal unchanged', t => {
  const dir = temporary(t);
  recordSession(25, 'Read', dir);
  const backup = createBackup(dir);
  backup.sessions[0].minutes = 30;
  const before = readFileSync(join(dir, 'sessions.jsonl'));
  assert.throws(() => restoreBackup(JSON.stringify(backup), dir), /conflicts/);
  assert.deepEqual(readFileSync(join(dir, 'sessions.jsonl')), before);
  assert.deepEqual(readdirSync(dir), ['sessions.jsonl']);
});

test('invalid input is fully rejected without modifying the journal', t => {
  const dir = temporary(t);
  recordSession(25, 'Read', dir);
  const backup = createBackup(dir);
  const before = readFileSync(join(dir, 'sessions.jsonl'));
  for (const text of ['bad json', '{}', JSON.stringify({ ...backup, version: 2 }), JSON.stringify({ ...backup, sessions: [...backup.sessions, { bad: true }] }), JSON.stringify({ ...backup, sessions: [...backup.sessions, ...backup.sessions] })]) {
    assert.throws(() => restoreBackup(text, dir));
    assert.deepEqual(readFileSync(join(dir, 'sessions.jsonl')), before);
  }
});

test('restoring into a corrupt journal leaves its bytes untouched', t => {
  const source = temporary(t), target = temporary(t);
  recordSession(25, 'Read', source);
  writeFileSync(join(target, 'sessions.jsonl'), 'bad json\n');
  assert.throws(() => restoreBackup(JSON.stringify(createBackup(source)), target), /Invalid session/);
  assert.equal(readFileSync(join(target, 'sessions.jsonl'), 'utf8'), 'bad json\n');
});

test('exclusive lock prevents a second writer or restore from losing updates', t => {
  const dir = temporary(t);
  recordSession(25, 'Read', dir);
  const backup = JSON.stringify(createBackup(dir));
  withJournalLock(dir, () => {
    assert.throws(() => recordSession(15, 'Write', dir), /Journal is in use/);
    assert.throws(() => restoreBackup(backup, dir), /Journal is in use/);
    assert.throws(() => createBackup(dir), /Journal is in use/);
  });
  recordSession(10, 'Learn', dir);
  assert.equal(readSessions(dir).length, 2);
});

test('UTF-8 BOM backups work and oversized or non-file inputs fail', t => {
  const dir = temporary(t);
  const text = JSON.stringify(createBackup(dir));
  assert.deepEqual(parseBackup('\uFEFF' + text), []);
  assert.throws(() => parseBackup(' '.repeat(8 * 1024 * 1024 + 1)), /8 MiB/);
  assert.throws(() => restoreBackupFile(dir, dir), /must be a file/);
});

test('CLI backups are machine-readable and restore preserves preexisting work', t => {
  const source = temporary(t), target = temporary(t);
  const backupFile = join(temporary(t), 'backup.json');
  recordSession(25, 'Read', source);
  recordSession(10, 'Write', target);
  const backup = spawnSync(process.execPath, ['src/cli.js', 'backup'], { env: { ...process.env, TINY_FOCUS_HOME: source }, encoding: 'utf8' });
  assert.equal(backup.status, 0, backup.stderr);
  assert.equal(JSON.parse(backup.stdout).sessions.length, 1);
  writeFileSync(backupFile, backup.stdout);
  const restored = spawnSync(process.execPath, ['src/cli.js', 'restore', backupFile], { env: { ...process.env, TINY_FOCUS_HOME: target }, encoding: 'utf8' });
  assert.equal(restored.status, 0, restored.stderr);
  assert.match(restored.stdout, /Restored 1 sessions/);
  assert.equal(readSessions(target).length, 2);
});

test('oversized CLI backups fail before emitting an unrestorable document', t => {
  const dir = temporary(t);
  const file = join(dir, 'sessions.jsonl');
  const sample = { completedAt: '2026-10-28T12:00:00.000Z', minutes: 25, label: 'x'.repeat(200) };
  const content = Array.from({ length: 30000 }, (_, index) => JSON.stringify({ ...sample, id: `sample-${index}` })).join('\n') + '\n';
  writeFileSync(file, content);
  const result = spawnSync(process.execPath, ['src/cli.js', 'backup'], { env: { ...process.env, TINY_FOCUS_HOME: dir }, encoding: 'utf8', timeout: 30_000, maxBuffer: 32 * 1024 * 1024 });
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /8 MiB/);
  assert.equal(result.stdout, '');
  assert.equal(readFileSync(file, 'utf8'), content);
});

test('serialized Unicode/control-safe backups can be parsed by the restore format', t => {
  const dir = temporary(t);
  const session = recordSession(25, 'کتاب 📚\u202e', dir);
  const text = createBackupText(dir);
  assert.doesNotMatch(text, /\u202e/);
  assert.deepEqual(parseBackup(text), [session]);
});

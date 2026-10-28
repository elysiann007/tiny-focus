import { readFileSync, statSync, openSync, writeFileSync, fsyncSync, closeSync, renameSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { dataDirectory, readSessions, validateSession, withJournalLock } from './journal.js';

const MAX_BACKUP_BYTES = 8 * 1024 * 1024;

export function createBackup(directory = dataDirectory()) {
  const sessions = withJournalLock(directory, () => readSessions(directory));
  return { format: 'tiny-focus', version: 1, createdAt: new Date().toISOString(), sessions };
}

export function parseBackup(text) {
  if (typeof text !== 'string' || Buffer.byteLength(text, 'utf8') > MAX_BACKUP_BYTES) throw new Error('Backup must be UTF-8 JSON, no larger than 8 MiB.');
  let backup;
  try { backup = JSON.parse(text.replace(/^\uFEFF/, '')); }
  catch { throw new Error('Backup is not valid JSON.'); }
  if (!backup || backup.format !== 'tiny-focus' || backup.version !== 1 || !Array.isArray(backup.sessions) ||
      typeof backup.createdAt !== 'string' || !Number.isFinite(Date.parse(backup.createdAt))) {
    throw new Error('Unsupported Tiny Focus backup format or version.');
  }
  const ids = new Set();
  for (const [index, session] of backup.sessions.entries()) {
    try { validateSession(session); }
    catch { throw new Error(`Invalid backup session at index ${index}.`); }
    if (ids.has(session.id)) throw new Error(`Duplicate session ID in backup at index ${index}.`);
    ids.add(session.id);
  }
  return backup.sessions;
}

export function restoreBackup(text, directory = dataDirectory()) {
  // Validate the complete input before acquiring a lock or touching the journal.
  const incoming = parseBackup(text);
  return withJournalLock(directory, () => {
    const current = readSessions(directory);
    const byId = new Map(current.map(session => [session.id, session]));
    const additions = [];
    let skipped = 0;
    for (const session of incoming) {
      const existing = byId.get(session.id);
      if (existing) {
        if (!isDeepStrictEqual(existing, session)) throw new Error('Backup conflicts with an existing session ID. Journal has not been changed.');
        skipped++;
      } else additions.push(session);
    }
    if (!additions.length) return { added: 0, skipped, total: current.length };
    const merged = [...current, ...additions];
    const content = merged.map(session => JSON.stringify(session)).join('\n') + '\n';
    const temporary = join(directory, `.restore-${randomUUID()}.tmp`);
    let handle;
    let created = false;
    try {
      handle = openSync(temporary, 'wx', 0o600);
      created = true;
      writeFileSync(handle, content, 'utf8');
      fsyncSync(handle);
      closeSync(handle);
      handle = undefined;
      renameSync(temporary, join(directory, 'sessions.jsonl'));
      created = false;
    } finally {
      if (handle !== undefined) closeSync(handle);
      if (created) unlinkSync(temporary);
    }
    return { added: additions.length, skipped, total: merged.length };
  });
}

export function restoreBackupFile(file, directory = dataDirectory()) {
  const info = statSync(file);
  if (!info.isFile() || info.size > MAX_BACKUP_BYTES) throw new Error('Backup must be a file no larger than 8 MiB.');
  return restoreBackup(readFileSync(file, 'utf8'), directory);
}

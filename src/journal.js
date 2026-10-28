import { mkdirSync, appendFileSync, readFileSync, openSync, closeSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';

export const dataDirectory = () => process.env.TINY_FOCUS_HOME || join(homedir(), '.tiny-focus');

export function withJournalLock(directory, action) {
  mkdirSync(directory, { recursive: true });
  const lockFile = join(directory, '.journal.lock');
  let handle;
  try { handle = openSync(lockFile, 'wx', 0o600); }
  catch (error) {
    if (error.code === 'EEXIST') throw new Error('Journal is in use. Retry after the other Tiny Focus command exits. See README for interrupted-lock recovery.');
    throw error;
  }
  try { return action(); }
  finally { closeSync(handle); unlinkSync(lockFile); }
}

export function minutes(value) {
  if (typeof value !== 'number' && (typeof value !== 'string' || !/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim()))) {
    throw new Error('Minutes must be a number between 0.001 and 1440.');
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0.001 || parsed > 1440) {
    throw new Error('Minutes must be a number between 0.001 and 1440.');
  }
  return parsed;
}

export function recordSession(duration, label = 'Focus', directory = dataDirectory()) {
  if (typeof label !== 'string') throw new Error('Label must be text.');
  const entry = { id: randomUUID(), completedAt: new Date().toISOString(), minutes: minutes(duration), label: label.trim() || 'Focus' };
  if (entry.label.length > 200) throw new Error('Label must be 200 characters or fewer.');
  withJournalLock(directory, () => {
    const content = journalContent(directory);
    parseJournal(content);
    const separator = content && !content.endsWith('\n') ? '\n' : '';
    appendFileSync(join(directory, 'sessions.jsonl'), separator + JSON.stringify(entry) + '\n', { mode: 0o600 });
  });
  return entry;
}

function journalContent(directory) {
  try { return readFileSync(join(directory, 'sessions.jsonl'), 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') return ''; throw error; }
}

export function validateSession(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry) ||
      typeof entry.id !== 'string' || !entry.id.trim() ||
      typeof entry.minutes !== 'number' ||
      typeof entry.label !== 'string' || !entry.label.trim() || entry.label.length > 200 ||
      typeof entry.completedAt !== 'string' || !Number.isFinite(Date.parse(entry.completedAt)) ||
      new Date(entry.completedAt).toISOString() !== entry.completedAt) {
    throw new Error('Invalid session data.');
  }
  minutes(entry.minutes);
  return entry;
}

function parseJournal(content) {
  const sessions = [];
  const ids = new Set();
  content.split(/\r?\n/).forEach((line, index) => {
    if (!line.trim()) return;
    try {
      const entry = validateSession(JSON.parse(line));
      if (ids.has(entry.id)) throw new Error('Duplicate session.');
      ids.add(entry.id);
      sessions.push(entry);
    } catch { throw new Error(`Invalid session on line ${index + 1}. Your journal has not been changed.`); }
  });
  return sessions;
}

export function readSessions(directory = dataDirectory()) {
  return parseJournal(journalContent(directory));
}

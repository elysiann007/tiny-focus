import { mkdirSync, appendFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';

export const dataDirectory = () => process.env.TINY_FOCUS_HOME || join(homedir(), '.tiny-focus');

export function minutes(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0.001 || parsed > 1440) {
    throw new Error('Minutes must be a number between 0.001 and 1440.');
  }
  return parsed;
}

export function recordSession(duration, label = 'Focus', directory = dataDirectory()) {
  const entry = { id: randomUUID(), completedAt: new Date().toISOString(), minutes: minutes(duration), label: String(label).trim() || 'Focus' };
  if (entry.label.length > 200) throw new Error('Label must be 200 characters or fewer.');
  mkdirSync(directory, { recursive: true });
  appendFileSync(join(directory, 'sessions.jsonl'), JSON.stringify(entry) + '\n', { mode: 0o600 });
  return entry;
}

export function readSessions(directory = dataDirectory()) {
  let content;
  try { content = readFileSync(join(directory, 'sessions.jsonl'), 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  return content.split(/\r?\n/).filter(line => line.trim()).map((line, index) => {
    try {
      const entry = JSON.parse(line);
      minutes(entry.minutes);
      if (typeof entry.label !== 'string' || !Number.isFinite(Date.parse(entry.completedAt))) throw new Error();
      return entry;
    } catch { throw new Error(`Invalid session on line ${index + 1}. Your journal has not been changed.`); }
  });
}

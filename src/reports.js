export function dateFormatter(timeZone = 'UTC') {
  if (typeof timeZone !== 'string' || !/^(?:UTC|[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+)+)$/.test(timeZone)) {
    throw new Error('Use an IANA time zone such as Europe/Istanbul or UTC.');
  }
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', calendar: 'iso8601', numberingSystem: 'latn' });
  } catch { throw new Error(`Unknown time zone: ${timeZone}.`); }
}

export function dailyStats(sessions, timeZone = 'UTC') {
  const formatter = dateFormatter(timeZone);
  const days = new Map();
  for (const session of sessions) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(session.completedAt)).map(part => [part.type, part.value]));
    const day = `${parts.year}-${parts.month}-${parts.day}`;
    const current = days.get(day) || { date: day, sessions: 0, minutes: 0 };
    current.sessions += 1;
    current.minutes += session.minutes;
    days.set(day, current);
  }
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function cell(value) {
  // Neutralize spreadsheet formulas even when preceded by whitespace.
  let text = String(value);
  if (/^\s*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}

export function toCsv(sessions) {
  return ['completed_at,minutes,label', ...sessions.map(s => [cell(s.completedAt), s.minutes, cell(s.label)].join(','))].join('\r\n') + '\r\n';
}

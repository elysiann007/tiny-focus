export function dailyStats(sessions) {
  const days = new Map();
  for (const session of sessions) {
    const day = new Date(session.completedAt).toISOString().slice(0, 10);
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

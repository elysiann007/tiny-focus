import { dailyStats } from './reports.js';
import { parseHistoryOptions, selectHistory } from './history.js';

const rounded = value => Number(value.toFixed(3));

export function parseSummaryOptions(args) {
  let timeZone = 'UTC';
  let timezoneSeen = false;
  const historyArgs = [];
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--limit') throw new Error('summary does not accept --limit; use --since and --until.');
    if (args[index] !== '--timezone') {
      const flag = args[index];
      historyArgs.push(flag);
      if (flag === '--since' || flag === '--until') historyArgs.push(args[++index]);
      continue;
    }
    if (timezoneSeen) throw new Error('Repeated summary option: --timezone.');
    timezoneSeen = true;
    const value = args[++index];
    if (value === undefined || value.startsWith('--')) throw new Error('Missing value for --timezone.');
    timeZone = value;
  }
  return { ...parseHistoryOptions(historyArgs), timeZone };
}

export function focusSummary(sessions, options = {}) {
  const timeZone = options.timeZone ?? 'UTC';
  const selected = selectHistory(sessions, options);
  const days = dailyStats(selected, timeZone);
  const labels = new Map();
  let total = 0;
  for (const session of selected) {
    total += session.minutes;
    const current = labels.get(session.label) || { label: session.label, sessions: 0, minutes: 0 };
    current.sessions++;
    current.minutes += session.minutes;
    labels.set(session.label, current);
  }
  const byLabel = [...labels.values()]
    .sort((a, b) => b.minutes - a.minutes || (a.label < b.label ? -1 : a.label > b.label ? 1 : 0))
    .map(entry => ({ ...entry, minutes: rounded(entry.minutes) }));
  return {
    timeZone,
    sessions: selected.length,
    totalMinutes: rounded(total),
    averageSessionMinutes: selected.length ? rounded(total / selected.length) : 0,
    activeDays: days.length,
    firstDay: days[0]?.date ?? null,
    lastDay: days.at(-1)?.date ?? null,
    byLabel
  };
}

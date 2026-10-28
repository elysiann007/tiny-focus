function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Dates must use YYYY-MM-DD.');
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.valueOf()) || date.toISOString().slice(0, 10) !== value) throw new Error('Date does not exist.');
  return value;
}

export function parseHistoryOptions(args) {
  const options = { json: false };
  const seen = new Set();
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    if (!['--json', '--since', '--until', '--limit'].includes(flag)) throw new Error(`Unknown history option: ${flag}.`);
    if (seen.has(flag)) throw new Error(`Repeated history option: ${flag}.`);
    seen.add(flag);
    if (flag === '--json') { options.json = true; continue; }
    const value = args[++index];
    if (value === undefined || value.startsWith('--')) throw new Error(`Missing value for ${flag}.`);
    if (flag === '--limit') {
      if (!/^[1-9]\d*$/.test(value) || Number(value) > 10_000) throw new Error('History limit must be an integer from 1 to 10000.');
      options.limit = Number(value);
    } else options[flag.slice(2)] = validDate(value);
  }
  if (options.since && options.until && options.since > options.until) throw new Error('--since must not be later than --until.');
  return options;
}

export function selectHistory(sessions, options = {}) {
  const since = options.since ? Date.parse(`${options.since}T00:00:00.000Z`) : -Infinity;
  const until = options.until ? Date.parse(`${options.until}T00:00:00.000Z`) + 86_400_000 : Infinity;
  const filtered = sessions.filter(session => {
    const instant = Date.parse(session.completedAt);
    return instant >= since && instant < until;
  });
  // The numeric timestamp comparison also handles canonical extended ISO years.
  filtered.sort((a, b) => Date.parse(a.completedAt) - Date.parse(b.completedAt));
  return options.limit ? filtered.slice(-options.limit) : filtered;
}

#!/usr/bin/env node
import { setTimeout as delay } from 'node:timers/promises';
import { minutes, readSessions, recordSession } from './journal.js';
import { dailyStats, toCsv } from './reports.js';
import { readFileSync } from 'node:fs';
import { openTasks } from './github.js';
import { terminalText } from './terminal.js';

const help = `Tiny Focus — offline focus journal

Usage:
  node src/cli.js start [minutes] [label]  Start a timer (default: 25)
  node src/cli.js log <minutes> [label]    Log a completed session
  node src/cli.js history                 Show completed sessions
  node src/cli.js stats                   Daily totals (UTC)
  node src/cli.js export                  Write CSV to stdout
  node src/cli.js --help                  Show this help
  node src/cli.js --version               Show the installed version
  node src/cli.js tasks <owner/repo>       List open public GitHub issues (online)

Quote labels containing spaces. Ctrl+C cancels a timer without recording it.
Data is saved in ~/.tiny-focus; override with TINY_FOCUS_HOME.`;

async function main() {
  const [command = '--help', duration, ...labelParts] = process.argv.slice(2);
  const label = labelParts.join(' ') || 'Focus';
  switch (command) {
    case '--help': case '-h': console.log(help); break;
    case '--version': case '-v': {
      if (duration !== undefined) throw new Error('--version does not accept arguments.');
      const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
      console.log(pkg.version);
      break;
    }
    case 'start': {
      const value = minutes(duration ?? 25);
      if (label.length > 200) throw new Error('Label must be 200 characters or fewer.');
      const deadline = Date.now() + value * 60_000;
      console.log(`Focusing: ${terminalText(label)} (${value} min). Ctrl+C to cancel.`);
      while (Date.now() < deadline) {
        const remaining = Math.max(1, Math.ceil((deadline - Date.now()) / 1000));
        if (process.stdout.isTTY) process.stdout.write(`\rRemaining: ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}   `);
        await delay(Math.min(1000, Math.max(1, deadline - Date.now())));
      }
      recordSession(value, label);
      console.log('\nSession complete! Take a short break.');
      break;
    }
    case 'log': {
      const entry = recordSession(duration, label);
      console.log(`Saved ${entry.minutes} min: ${terminalText(entry.label)}`);
      break;
    }
    case 'history': {
      if (duration !== undefined) throw new Error('history does not accept arguments.');
      const sessions = readSessions();
      if (!sessions.length) console.log('No sessions yet. Try: node src/cli.js log 25 "Reading"');
      else for (const entry of sessions) console.log(`${entry.completedAt}  ${entry.minutes} min  ${JSON.stringify(entry.label)}`);
      break;
    }
    case 'stats': {
      if (duration !== undefined) throw new Error('stats does not accept arguments.');
      const days = dailyStats(readSessions());
      if (!days.length) console.log('No sessions yet.');
      else {
        console.log('Date (UTC)  Sessions  Minutes');
        for (const day of days) console.log(`${day.date}  ${day.sessions}  ${Number(day.minutes.toFixed(3))}`);
      }
      break;
    }
    case 'export': {
      if (duration !== undefined) throw new Error('export does not accept arguments.');
      process.stdout.write(toCsv(readSessions()));
      break;
    }
    case 'tasks': {
      if (labelParts.length) throw new Error('tasks accepts only one owner/repo argument.');
      const tasks = await openTasks(duration);
      if (!tasks.length) console.log('No open issues found in the first 100 results.');
      else {
        console.log('Up to 10 issues from the first 100 open issue/PR results:');
        for (const task of tasks) console.log(`#${task.number} ${task.title}\n  ${task.url}`);
        console.log('\nChoose a task, then start a focus session with its title.');
      }
      break;
    }
    default: throw new Error(`Unknown command: ${command}. Use --help.`);
  }
}

main().catch(error => { console.error(`Error: ${terminalText(error.message)}`); process.exitCode = 1; });

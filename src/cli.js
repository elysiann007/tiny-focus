#!/usr/bin/env node
import { minutes, readSessions, recordSession } from './journal.js';
import { dailyStats, toCsv } from './reports.js';
import { readFileSync } from 'node:fs';
import { openTasks } from './github.js';
import { terminalText, jsonText } from './terminal.js';
import { runTimer } from './timer.js';
import { createBackup, restoreBackupFile } from './backup.js';
import { parseHistoryOptions, selectHistory } from './history.js';
import { focusSummary, parseSummaryOptions } from './summary.js';

const help = `Tiny Focus — offline focus journal

Usage:
  node src/cli.js start [minutes] [label]  Start a timer (default: 25)
  node src/cli.js break [minutes]          Take a break (default: 5, never logged)
  node src/cli.js log <minutes> [label]    Log a completed session
  node src/cli.js history [options]       Show completed sessions in time order
  node src/cli.js stats [--timezone IANA]  Daily totals (default: UTC)
  node src/cli.js summary [options]       Totals, active days and label breakdown
  node src/cli.js export                  Write CSV to stdout
  node src/cli.js backup                  Write a JSON backup to stdout
  node src/cli.js restore <backup.json>    Merge a backup, preserving local sessions
  node src/cli.js --help                  Show this help
  node src/cli.js --version               Show the installed version
  node src/cli.js tasks <owner/repo>       List open public GitHub issues (online)

Quote labels containing spaces. Ctrl+C cancels a timer without recording it.
Data is saved in ~/.tiny-focus; override with TINY_FOCUS_HOME.
History options: --since YYYY-MM-DD --until YYYY-MM-DD --limit 1..10000 --json
History date boundaries are inclusive UTC days.
Summary options: --since YYYY-MM-DD --until YYYY-MM-DD --timezone IANA --json`;

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
    case 'start': case 'break': {
      const isBreak = command === 'break';
      if (isBreak && labelParts.length) throw new Error('break accepts only an optional duration.');
      const value = minutes(duration ?? (isBreak ? 5 : 25));
      if (label.length > 200) throw new Error('Label must be 200 characters or fewer.');
      const controller = new AbortController();
      let exitCode = 130;
      const interrupt = () => { exitCode = 130; controller.abort(); };
      const terminate = () => { exitCode = 143; controller.abort(); };
      process.once('SIGINT', interrupt);
      process.once('SIGTERM', terminate);
      console.log(`${isBreak ? 'Taking a break' : `Focusing: ${terminalText(label)}`} (${value} min). Ctrl+C to cancel.`);
      try {
        await runTimer(value, { signal: controller.signal, onTick(remaining) {
          if (process.stdout.isTTY) process.stdout.write(`\rRemaining: ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}   `);
        } });
      } catch (error) {
        if (!controller.signal.aborted) throw error;
        console.log('\nTimer cancelled. No focus session was saved.');
        process.exitCode = exitCode;
        break;
      } finally {
        process.removeListener('SIGINT', interrupt);
        process.removeListener('SIGTERM', terminate);
      }
      if (isBreak) console.log('\nBreak complete! Ready for your next focus session.');
      else {
        recordSession(value, label);
        console.log('\nSession complete! Take a short break.');
      }
      break;
    }
    case 'log': {
      const entry = recordSession(duration, label);
      console.log(`Saved ${entry.minutes} min: ${terminalText(entry.label)}`);
      break;
    }
    case 'history': {
      const options = parseHistoryOptions(process.argv.slice(3));
      const sessions = selectHistory(readSessions(), options);
      if (options.json) process.stdout.write(jsonText(sessions));
      else if (!sessions.length) console.log('No matching sessions. Try: node src/cli.js log 25 "Reading"');
      else for (const entry of sessions) console.log(`${entry.completedAt}  ${entry.minutes} min  ${terminalText(JSON.stringify(entry.label))}`);
      break;
    }
    case 'stats': {
      let timeZone = 'UTC';
      if (duration !== undefined) {
        if (duration !== '--timezone' || labelParts.length !== 1) throw new Error('Usage: stats [--timezone Europe/Istanbul]');
        timeZone = labelParts[0];
      }
      const days = dailyStats(readSessions(), timeZone);
      if (!days.length) console.log('No sessions yet.');
      else {
        console.log(`Date (${timeZone})  Sessions  Minutes`);
        for (const day of days) console.log(`${day.date}  ${day.sessions}  ${Number(day.minutes.toFixed(3))}`);
      }
      break;
    }
    case 'summary': {
      const options = parseSummaryOptions(process.argv.slice(3));
      const summary = focusSummary(readSessions(), options);
      if (options.json) process.stdout.write(jsonText(summary));
      else {
        console.log(`Focus summary (${summary.timeZone})`);
        console.log(`Sessions: ${summary.sessions}\nTotal minutes: ${summary.totalMinutes}\nAverage session: ${summary.averageSessionMinutes} min\nActive days: ${summary.activeDays}`);
        if (summary.firstDay) console.log(`Period: ${summary.firstDay} through ${summary.lastDay}`);
        if (summary.byLabel.length) {
          console.log('\nBy label:');
          for (const entry of summary.byLabel) console.log(`${entry.minutes} min  ${entry.sessions} sessions  ${terminalText(JSON.stringify(entry.label))}`);
        }
      }
      break;
    }
    case 'export': {
      if (duration !== undefined) throw new Error('export does not accept arguments.');
      process.stdout.write(toCsv(readSessions()));
      break;
    }
    case 'backup': {
      if (duration !== undefined) throw new Error('backup does not accept arguments.');
      process.stdout.write(jsonText(createBackup()));
      break;
    }
    case 'restore': {
      if (!duration || labelParts.length) throw new Error('Usage: restore <backup.json>');
      const result = restoreBackupFile(duration);
      console.log(`Restored ${result.added} sessions; skipped ${result.skipped} identical sessions; total ${result.total}.`);
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

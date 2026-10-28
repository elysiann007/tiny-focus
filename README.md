# Tiny Focus

[![Tests](https://github.com/elysiann007/tiny-focus/actions/workflows/test.yml/badge.svg)](https://github.com/elysiann007/tiny-focus/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A tiny, offline-first Pomodoro timer and focus journal for your terminal. Built with Node.js, without runtime dependencies, accounts, or telemetry.

## Get started

Install Node.js 22+ first, then:

```sh
git clone https://github.com/elysiann007/tiny-focus.git
cd tiny-focus
node src/cli.js --help
```

Try the entire journal/report/backup workflow without touching your own data:

```sh
npm run demo
```

The demo uses three explicitly fictional sample sessions, runs the real CLI in temporary data directories, checks report and restore results, and removes the temporary files afterward. It makes no network calls and overrides `TINY_FOCUS_HOME` for every child command.

Example output from those samples:

```text
Focus summary (Europe/Istanbul)
Sessions: 3
Total minutes: 60
Average session: 20 min
Active days: 2
Period: 2026-10-27 through 2026-10-28

By label:
40 min  2 sessions  "Read"
20 min  1 sessions  "Write"
```

## Usage

```sh
node src/cli.js start 25 "Learn JavaScript"
node src/cli.js break 5
node src/cli.js log 15 "Read a chapter"
node src/cli.js history
node src/cli.js history --since 2026-10-01 --until 2026-10-31 --limit 10 --json
node src/cli.js stats
node src/cli.js stats --timezone Europe/Istanbul
node src/cli.js summary --timezone Europe/Istanbul
node src/cli.js export > sessions.csv
```

Press Ctrl+C to cancel a timer. Cancelled sessions are not logged. Times are recorded in UTC. Journals stay in `~/.tiny-focus/sessions.jsonl`; set `TINY_FOCUS_HOME` to use a different directory. No data is uploaded. Labels are stored as plain text on your own computer. Avoid sensitive notes on shared computers. Keep a backup of your journal.

The `break` timer defaults to five minutes and never writes a focus session. Timers use a monotonic clock, so changing your system clock does not change the countdown. Cancelling with Ctrl+C exits with code 130; termination exits with code 143 where the OS delivers SIGTERM. Closing a process forcibly never records an unfinished focus timer.

Focus timers check the journal and writer lock before starting, so corrupt data or an unavailable data path fails immediately instead of after a full focus session. This check creates the data directory if needed but does not create a session journal. The lock is released before the countdown; permissions, disk space or another writer can still change before completion, when saving is validated again. Break timers do not depend on journal availability.

History displays sessions in completion-time order, including sessions restored from older backups. Optional `--since YYYY-MM-DD` and `--until YYYY-MM-DD` filters include the entire boundary days in **UTC**. `--limit 10` keeps the newest ten matches after filtering and displays them chronologically; limits must be 1–10000. `--json` emits only a JSON array (including `[]` when empty), preserving labels for scripts. These options can be combined and never rewrite the journal. Date filters are UTC even when `stats --timezone` uses local dates.

`summary` shows completed session count, total minutes, average session duration, active calendar days, and totals by exact label. Use `--timezone` for local day grouping, `--since`/`--until` for inclusive **UTC** date filtering, and `--json` for scripts. Labels are ranked by total minutes; numeric totals are rounded to three decimal places. Empty reports contain zero totals and no first/last day. The command reads your journal without changing it.

Daily totals use UTC dates by default, including when your local day differs. Use `stats --timezone Europe/Istanbul` (or another IANA time zone such as `America/New_York`) to group by local calendar days, including daylight saving transitions. Stored timestamps and CSV exports remain UTC. Invalid time zones fail without changing your journal.

CSV export escapes multiline labels and neutralizes spreadsheet formula prefixes. Exported files contain your session labels; share only what you intend to make public.

CSV/JSON commands also work with consumers that intentionally stop reading early, such as `head`: a closed output pipe exits quietly without changing the journal. A prefix of a JSON document is not a restorable backup; retain the complete output when creating backups.

On Windows PowerShell, you can explicitly request UTF-8 for exports:

```powershell
node src/cli.js export | Set-Content -Encoding utf8 sessions.csv
```

## Features

1. Cancellable focus and break timers, manual session logging, and local history.
2. Daily statistics in UTC or your chosen IANA time zone, plus safe CSV export.
3. Optional public GitHub issue discovery to choose your next focus task.
4. JSON backups and merge-only restore that preserves existing sessions.

## Back up and restore

```sh
node src/cli.js backup > focus-backup.json
node src/cli.js restore focus-backup.json
```

In Windows PowerShell, explicitly select UTF-8 for the backup:

```powershell
node src/cli.js backup | Set-Content -Encoding utf8 focus-backup.json
```

Backups contain your labels and timestamps. Store them privately. Restore accepts Tiny Focus format version 1 JSON files up to 8 MiB, validates the complete input, and merges sessions by ID. Identical sessions are skipped; conflicts or malformed input leave the journal unchanged. Existing local sessions are never removed. UTF-8 BOM files are supported. CSV exports are for spreadsheets and cannot be restored as backups.

The `backup` command checks the final UTF-8 output size, including formatting and escaped controls, before writing anything to stdout. If it would exceed the 8 MiB restore limit, it fails and leaves the source journal unchanged; copy `sessions.jsonl` directly for a full archive of a larger journal. Write backups to a new filename and check command success before relying on the file, because shell redirection opens the destination before the CLI runs.

Writers and backups use an exclusive `.journal.lock` file in the data directory. Retry a busy journal after the other command exits. If a forced shutdown leaves a stale lock, close **all** Tiny Focus commands, copy your data directory as a backup, and remove **only** `.journal.lock` manually. Never remove a lock while a writer may still be running. Restore stages and flushes a temporary file before replacing the journal. This protects against ordinary concurrent Tiny Focus commands; it does not coordinate with external editors or guarantee recovery after disk failure.

## Pick a GitHub task

```sh
node src/cli.js tasks elysiann007/tiny-focus
node src/cli.js start 25 "Work on a GitHub issue"
```

Only `tasks` needs internet access. It sends the requested repository name to GitHub's public REST API, fetches the first 100 open issue/PR entries, excludes PRs, and shows up to 10 issues. It does not send your journal, authenticate, modify issues, or read private repositories. GitHub can see normal request metadata such as your IP address. Public API rate limits apply; retry later if limited. Redirected/renamed repositories require the current owner/repo name.

## Help improve it

See [contributing](CONTRIBUTING.md), browse [beginner-friendly issues](https://github.com/elysiann007/tiny-focus/labels/good%20first%20issue), or ask a question in [Discussions](https://github.com/elysiann007/tiny-focus/discussions). If the project is useful to you, a GitHub star helps other people find it.

## Türkçe hızlı başlangıç

Tiny Focus, bilgisayarında çalışan küçük bir odak günlüğüdür. Node.js 22+ kuruluysa depoyu indirip `node src/cli.js start 25 "Ders çalış"` komutuyla başla. Tamamladığın çalışmayı elle kaydetmek için `log`, geçmiş için `history`, günlük toplamlar için `stats`, CSV almak için `export` kullan. API anahtarı ve ücretli servis gerekmez.

Requires Node.js 22 or newer. Source code is MIT licensed.

## Development

```sh
npm test
```

CI runs the same test suite and isolated demo on Windows and Linux with Node.js 22 and 24. Pull requests and main-branch pushes are checked; superseded runs are cancelled. See the [changelog](CHANGELOG.md) for release details.

Check the distribution package locally:

```sh
npm run check:package
```

This requires the system `tar` utility. It creates an offline npm archive, verifies the file allowlist, extracts it to a temporary directory, runs the packaged CLI and demo, and removes the temporary files. No installation or registry publication occurs; the package is marked private. Only source, tests, scripts and public documentation are included, so incidental local notes and generated archives stay out of packages.

Developed with assistance from OpenAI Codex. Commit authorship belongs to the repository owner; no human collaborators are implied.

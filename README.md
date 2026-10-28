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

## Usage

```sh
node src/cli.js start 25 "Learn JavaScript"
node src/cli.js log 15 "Read a chapter"
node src/cli.js history
node src/cli.js stats
node src/cli.js export > sessions.csv
```

Press Ctrl+C to cancel a timer. Cancelled sessions are not logged. Times are recorded in UTC. Journals stay in `~/.tiny-focus/sessions.jsonl`; set `TINY_FOCUS_HOME` to use a different directory. No data is uploaded. Labels are stored as plain text on your own computer. Avoid sensitive notes on shared computers. Keep a backup of your journal.

Daily totals use UTC dates, including when your local day differs. CSV export escapes multiline labels and neutralizes spreadsheet formula prefixes. Exported files contain your session labels; share only what you intend to make public.

On Windows PowerShell, you can explicitly request UTF-8 for exports:

```powershell
node src/cli.js export | Set-Content -Encoding utf8 sessions.csv
```

## Features

1. Focus timer, manual session logging, and local history.
2. Daily statistics and CSV export.
3. Optional public GitHub issue discovery to choose your next focus task.

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

Developed with assistance from OpenAI Codex. Commit authorship belongs to the repository owner; no human collaborators are implied.

# Tiny Focus

A tiny, offline-first Pomodoro timer and focus journal for your terminal. Built with Node.js, without runtime dependencies, accounts, or telemetry.

## Usage

```sh
node src/cli.js start 25 "Learn JavaScript"
node src/cli.js log 15 "Read a chapter"
node src/cli.js history
```

Press Ctrl+C to cancel a timer. Cancelled sessions are not logged. Times are recorded in UTC. Journals stay in `~/.tiny-focus/sessions.jsonl`; set `TINY_FOCUS_HOME` to use a different directory. No data is uploaded. Labels are stored as plain text on your own computer. Avoid sensitive notes on shared computers. Keep a backup of your journal.

## Project plan

1. Focus timer, manual session logging, and local history.
2. Daily statistics and CSV export.

Requires Node.js 22 or newer. Source code is MIT licensed.

## Development

```sh
npm test
```

Developed with assistance from OpenAI Codex. Commit authorship belongs to the repository owner; no human collaborators are implied.

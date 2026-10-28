# Changelog

## Unreleased

- Added chronological history queries with inclusive UTC date filters, newest-match limits, and machine-readable JSON output.
- Escaped bidirectional controls in JSON terminal output while preserving parsed session values.

## 1.3.0 — 2026-10-28

- Added portable UTF-8 JSON backups with `backup`.
- Added validated merge-only `restore`, with ID deduplication and conflict detection.
- Added an exclusive writer lock and flushed temporary-file replacement for restores.
- Documented backup privacy, size limits, and interrupted-lock recovery.

## 1.2.0 — 2026-10-28

- Added a configurable break timer that never counts breaks as focus sessions.
- Switched countdowns to a monotonic clock and added graceful cancellation.
- Added `stats --timezone Europe/Istanbul` and other IANA zones, keeping UTC storage.
- Hardened journal validation against invalid types, dates, and duplicate IDs.
- Prevented appends to corrupt journals and fixed missing-trailing-newline appends.
- Neutralized terminal control characters in focus labels, history, and errors.
- Expanded CI coverage to Node.js 22/24 on Windows and Linux.

## 1.1.0 — 2026-10-28

- Added optional public GitHub issue discovery with `tasks owner/repo`.
- Added contribution guides and issue/PR templates.
- Added connection, rate limit, invalid response, and terminal-control handling.

## 1.0.0 — 2026-10-28

- Initial offline Pomodoro timer and focus journal.
- Manual session logging, history, daily UTC totals, and CSV export.
- Version reporting and English/Turkish getting-started instructions.

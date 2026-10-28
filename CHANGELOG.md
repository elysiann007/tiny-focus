# Changelog

## 1.4.1 — 2026-10-28

- Reject oversized serialized backups before stdout output, ensuring generated backups stay within restore's 8 MiB UTF-8 limit.
- Cover large-journal rejection, unchanged source bytes and Unicode/control-safe backup round trips.

## 1.4.0 — 2026-10-28

- Added an explicit distribution file allowlist and offline extracted-package checks in all four CI combinations.

- Added an isolated real-CLI demo with fictional samples and backup round-trip assertions.
- Run tests and demo on pull requests and main pushes, avoiding duplicate feature-push runs while retaining all four compatibility combinations.

- Added focus-timer journal preflight to reject corrupt, busy or unusable storage before the countdown begins, while keeping break timers independent.
- Added text/JSON focus summaries with total minutes, average duration, active days, date ranges and exact-label breakdowns.
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

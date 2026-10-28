# Contributing to Tiny Focus

Thanks for helping build a small, useful focus tool. Node.js 22+ and Git are the only prerequisites. There are no packages to install.

1. Fork this repository and clone your fork.
2. Create a branch for one focused change.
3. Run `npm test` before and after your change. Tests use temporary journals, never your real focus history.
4. Add a test for behavior changes. Network tests must use a fake fetch function; CI must work offline.
5. Open a pull request explaining the user problem, resulting behavior, and validation.

Look for issues marked **good first issue**. Ask implementation questions in the repository's Q&A Discussions. Maintainer response times are not guaranteed.

Keep runtime dependencies at zero. Do not add telemetry, upload focus logs, or require a paid service. The GitHub `tasks` command is explicitly online and reads public issues without credentials.

Credit only people who actually contributed. Use `Co-authored-by` only for genuine shared work and with the contributor's agreement. AI assistance can be disclosed in the PR description.

## Questions and bugs

Use Discussions for questions and the bug template for reproducible defects. Redact personal session labels, filesystem paths, and credentials from all reports.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

test('both version aliases report the package version without accessing the journal', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  for (const flag of ['--version', '-v']) {
    const run = spawnSync(process.execPath, [fileURLToPath(new URL('../src/cli.js', import.meta.url)), flag], { encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr);
    assert.equal(run.stdout.trim(), pkg.version);
  }
});

test('help lists the version command and extra version arguments fail', () => {
  const help = spawnSync(process.execPath, ['src/cli.js', '--help'], { encoding: 'utf8' });
  assert.equal(help.status, 0);
  assert.match(help.stdout, /--version/);
  const invalid = spawnSync(process.execPath, ['src/cli.js', '--version', 'extra'], { encoding: 'utf8' });
  assert.equal(invalid.status, 1);
});

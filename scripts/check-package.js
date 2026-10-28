import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, readFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('..', import.meta.url));
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('Run this check with npm run check:package.');
const directory = mkdtempSync(join(tmpdir(), 'tiny-focus-package-'));

function run(command, args, cwd = root) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    timeout: 60_000,
    env: { ...process.env, npm_config_update_notifier: 'false', npm_config_audit: 'false', TINY_FOCUS_HOME: join(directory, 'unused-journal') }
  });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

try {
  // --offline and --ignore-scripts keep package creation local and predictable.
  const [packed] = JSON.parse(run(process.execPath, [npmCli, 'pack', '--offline', '--ignore-scripts', '--json', '--pack-destination', directory]));
  const expected = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  assert.equal(packed.version, expected.version);
  assert.equal(basename(packed.filename), packed.filename);
  const paths = packed.files.map(file => file.path);
  for (const path of paths) {
    assert.ok(/^(?:src\/|test\/|scripts\/|README\.md$|CHANGELOG\.md$|CONTRIBUTING\.md$|LICENSE$|package\.json$)/.test(path), `Unexpected package file: ${path}`);
    assert.ok(!path.split('/').includes('..'), 'Unexpected parent path in package.');
  }
  for (const required of ['src/cli.js', 'scripts/demo.js', 'test/journal.test.js', 'README.md', 'LICENSE', 'package.json']) assert.ok(paths.includes(required), `Missing ${required}`);
  assert.ok(!paths.includes('DEVELOPMENT_LOG.md'), 'Local development notes must not be packaged.');

  const extraction = join(directory, 'extracted');
  mkdirSync(extraction);
  // Only extract the archive just created above from this trusted source tree.
  run('tar', ['-xzf', join(directory, packed.filename), '-C', extraction]);
  const extractedRoot = join(extraction, 'package');
  const version = run(process.execPath, ['src/cli.js', '--version'], extractedRoot).trim();
  assert.equal(version, expected.version);
  const demo = run(process.execPath, ['scripts/demo.js'], extractedRoot);
  assert.match(demo, /Demo assertions passed/);
  console.log(`Package validation passed: ${packed.filename} (${paths.length} files).`);
  console.log('The extracted CLI version and isolated backup/report demo passed without installs or network calls.');
} finally {
  // This directory was created by this invocation and contains only its artifacts.
  rmSync(directory, { recursive: true, force: true });
}

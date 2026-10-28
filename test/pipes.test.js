import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';

function consumePrefix(args, directory) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['src/cli.js', ...args], { env: { ...process.env, TINY_FOCUS_HOME: directory }, stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    let received = false;
    const timeout = setTimeout(() => child.kill(), 10_000);
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', text => { stderr += text; });
    child.stdout.once('data', () => {
      received = true;
      // Model a consumer such as head exiting after reading a prefix.
      child.stdout.destroy();
    });
    child.once('error', error => { clearTimeout(timeout); reject(error); });
    child.once('close', (code, signal) => { clearTimeout(timeout); resolve({ code, signal, stderr, received }); });
  });
}

test('closed output pipes do not crash CSV or JSON commands or change journal data', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'tiny-focus-pipe-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const sample = { completedAt: '2026-10-28T12:00:00.000Z', minutes: 25, label: 'x'.repeat(200) };
  const content = Array.from({ length: 5000 }, (_, index) => JSON.stringify({ ...sample, id: `pipe-${index}` })).join('\n') + '\n';
  const file = join(dir, 'sessions.jsonl');
  writeFileSync(file, content);
  for (const args of [['export'], ['history', '--json'], ['backup']]) {
    const result = await consumePrefix(args, dir);
    assert.equal(result.received, true, 'Consumer must receive some output before closing.');
    assert.equal(result.code, 0, `${args.join(' ')}: ${result.stderr}`);
    assert.equal(result.signal, null);
    assert.equal(result.stderr, '');
    assert.equal(readFileSync(file, 'utf8'), content);
  }
});

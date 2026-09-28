import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { summarize, benchmark } from './cli.mjs';

test('reports median and nearest-rank p95 without choosing fastest samples', () => {
  assert.deepEqual(summarize([10, 1, 5, 8].map((durationMs) => ({ durationMs }))), { medianMs: 6.5, p95Ms: 10 });
});
test('rejects incomplete prerequisites before invoking any project command', async () => {
  await assert.rejects(benchmark(['--iterations', '2']), /at least 10/);
});
test('observer keeps payload contents out and labels overlapping phases', () => {
  const output = join(mkdtempSync(join(tmpdir(), 'renku-observe-')), 'report.json');
  const observer = new URL('./observe.mjs', import.meta.url);
  observer.searchParams.set('output', output);
  const result = spawnSync(process.execPath, ['--import', observer.href, '--input-type=module', '-e',
    `import { channel } from 'node:diagnostics_channel'; channel('renku.performance').publish({package:'cli',phase:'command',durationMs:1,outcome:'failure',prompt:'secret'});`], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(readFileSync(output));
  assert.equal(report.measurements.length, 1);
  assert.equal(report.measurements[0].outcome, 'failure');
  assert.ok(!JSON.stringify(report).includes('secret'));
  assert.match(report.note, /overlap/);
});

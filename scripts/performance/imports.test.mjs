import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const cli = fileURLToPath(new URL('../../packages/cli/dist/cli.js', import.meta.url));
const vendorSdk = /(?:@elevenlabs\/elevenlabs-js|@fal-ai\/client|node_modules\/replicate\/)/;
function probe(args) {
  const output = join(mkdtempSync(join(tmpdir(), 'renku-import-probe-')), 'report.json');
  const observer = new URL('./observe.mjs', import.meta.url);
  observer.searchParams.set('output', output);
  const result = spawnSync(process.execPath, ['--import', observer.href, ...args], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(readFileSync(output));
}
for (const args of [[], ['--help'], ['--version']]) {
  test(`fresh help/version process loads no domain, server or provider capabilities: ${args}`, () => {
    const report = probe([cli, ...args]);
    assert.deepEqual(report.modules.filter((url) => /(?:studio-core|studio-engines|packages\/(?:core|engines)\/|studio\/(?:server-dist|dist-server))/.test(url)), []);
  });
}
test('current-project descriptor read loads no database or vendor capabilities', () => {
  const report = probe([cli, 'project', 'current', '--json']);
  assert.deepEqual(report.modules.filter((url) => vendorSdk.test(url) || /better-sqlite3|drizzle-orm|\/database\/access\//.test(url)), []);
});
for (const args of [['studio', 'server', 'status', '--json'], ['studio', 'current', '--json'], ['studio', 'stop', '--json']]) {
  test(`${args.join(' ')} does not load the Studio server or vendor SDKs`, () => {
    const homeDir = mkdtempSync(join(tmpdir(), 'renku-studio-probe-'));
    const report = probe(['--input-type=module', '-e', `const { runRenkuCli } = await import(${JSON.stringify(pathToFileURL(cli).href)}); process.exitCode = await runRenkuCli(${JSON.stringify(args)}, { homeDir: ${JSON.stringify(homeDir)} });`]);
    assert.deepEqual(report.modules.filter((url) => vendorSdk.test(url) || /studio\/(?:server-dist|dist-server)/.test(url)), []);
  });
}
test('importing Engines does not load vendor SDKs', () => {
  const engines = new URL('../../packages/engines/dist/index.js', import.meta.url).href;
  const report = probe(['--input-type=module', '-e', `await import(${JSON.stringify(engines)})`]);
  assert.deepEqual(report.modules.filter((url) => vendorSdk.test(url)), []);
});

test('already-running Studio start does not import the server implementation', () => {
  const homeDir = mkdtempSync(join(tmpdir(), 'renku-start-probe-'));
  const core = new URL('../../packages/core/dist/server/index.js', import.meta.url).href;
  const report = probe(['--input-type=module', '-e', `
    const { claimStudioRuntimeDescriptor } = await import(${JSON.stringify(core)});
    await claimStudioRuntimeDescriptor({ homeDir: ${JSON.stringify(homeDir)}, host: '127.0.0.1', port: 5173, serverUrl: 'http://127.0.0.1:5173' });
    const { runRenkuCli } = await import(${JSON.stringify(pathToFileURL(cli).href)});
    process.exitCode = await runRenkuCli(['studio', 'start', '--no-browser'], { homeDir: ${JSON.stringify(homeDir)} });
  `]);
  assert.deepEqual(report.modules.filter((url) => /studio\/(?:server-dist|dist-server)/.test(url)), []);
});

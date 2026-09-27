import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, createReadStream, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const productArgument = process.argv[2];
if (process.platform !== 'darwin' || !productArgument || process.argv.length !== 3) {
  console.error('Usage (macOS): node scripts/release/verify-studio-update.mjs <assembled-product-directory>');
  process.exit(1);
}
const sourceProduct = path.resolve(productArgument);
const sourceRelease = readJson(path.join(sourceProduct, 'RELEASE.json'));
assert.equal(sourceRelease.product, 'renku');
assert.equal(sourceRelease.target, `darwin-${process.arch}`);
for (const relative of ['runtime/node/bin/node', 'app/dist/cli.js', 'app/package.json', 'distribution/install.sh']) {
  assert.ok(existsSync(path.join(sourceProduct, relative)), `Assembled product lacks ${relative}`);
}
assert.ok(existsSync(path.join(sourceProduct, 'app/node_modules/@gorenku/studio/server-dist/routes/studio-update.js')),
  'The assembled product does not contain the Studio update route. Assemble the current build first.');
if (await portOccupied(5173)) throw new Error('Port 5173 is occupied. Stop the existing Studio before running this isolated rehearsal.');

const root = mkdtempSync(path.join(os.tmpdir(), 'renku-studio-update-rehearsal-'));
const host = '127.0.0.1';
const versionKeys = new Map();
const requestLog = [];
let offeredVersion = '0.0.1';
let manifest;
for (const version of ['0.0.1', '0.0.2']) {
  const productParent = path.join(root, `product-${version}`);
  const product = path.join(productParent, 'renku');
  mkdirSync(productParent, { recursive: true });
  cpSync(sourceProduct, product, { recursive: true, dereference: true });
  writeJson(path.join(product, 'RELEASE.json'), { ...sourceRelease, version });
  const cliPackage = path.join(product, 'app/package.json');
  writeJson(cliPackage, { ...readJson(cliPackage), version });
  const archiveParent = path.join(root, `archive-${version}`);
  execFileSync(process.execPath, [path.join(repositoryRoot, 'scripts/release/package-product.mjs'), productParent, archiveParent], { stdio: 'inherit' });
  const archive = path.join(archiveParent, 'renku.tar.gz');
  versionKeys.set(version, { archive, sha256: sha256(archive) });
}

const server = createServer((request, response) => {
  requestLog.push({ at: new Date().toISOString(), path: request.url });
  writeJson(path.join(root, 'request-log.json'), requestLog);
  if (request.url === '/studio/channels/beta/release.json') {
    manifest = {
      product: 'renku', channel: 'beta', version: offeredVersion,
      artifacts: [{
        target: sourceRelease.target,
        versionKey: `studio/releases/${offeredVersion}/${sourceRelease.target}/renku.tar.gz`,
        sha256: versionKeys.get(offeredVersion).sha256,
      }],
    };
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify(manifest));
    return;
  }
  for (const [version, artifact] of versionKeys) {
    if (request.url === `/studio/releases/${version}/${sourceRelease.target}/renku.tar.gz`) {
      response.setHeader('Content-Type', 'application/gzip');
      createReadStream(artifact.archive).pipe(response);
      return;
    }
  }
  response.writeHead(404).end();
});
await new Promise((resolve) => server.listen(0, host, resolve));
const downloadBaseUrl = `http://${host}:${server.address().port}`;
const home = path.join(root, 'home');
const installRoot = path.join(root, 'installed');
const binRoot = path.join(root, 'bin');
const storageRoot = path.join(root, 'projects');
mkdirSync(home, { recursive: true });
const environment = {
  ...process.env,
  HOME: home,
  ZDOTDIR: home,
  XDG_CONFIG_HOME: path.join(home, '.config'),
  FLATPAK_XDG_CONFIG_HOME: path.join(home, '.config'),
  USERPROFILE: home,
  APPDATA: path.join(home, 'AppData', 'Roaming'),
  LOCALAPPDATA: path.join(home, 'AppData', 'Local'),
  CODEX_HOME: path.join(home, '.codex'),
  CLAUDE_CONFIG_DIR: path.join(home, '.claude'),
  VIBE_HOME: path.join(home, '.vibe'),
  HERMES_HOME: path.join(home, '.hermes'),
  AUTOHAND_HOME: path.join(home, '.autohand'),
  GROK_HOME: path.join(home, '.grok'),
  SARVAM_HOME: path.join(home, '.sarvam'),
  SHELL: '/bin/zsh',
  RENKU_DOWNLOAD_BASE_URL: downloadBaseUrl,
  RENKU_INSTALL_ROOT: installRoot,
  RENKU_BIN_ROOT: binRoot,
};
const launcher = path.join(binRoot, 'renku');
const prompt = createInterface({ input: process.stdin, output: process.stdout });
try {
  const installer = path.join(root, 'product-0.0.1/renku/distribution/install.sh');
  launchTerminal('install-fixture', `/usr/bin/env ${environmentAssignments(environment)} /bin/sh ${shellQuote(installer)}`);
  console.log(`\nIsolated rehearsal: ${root}`);
  await prompt.question('Complete the installer and skills prompts in Terminal, then press Return here. ');
  assert.ok(existsSync(launcher), 'The isolated installer did not create its launcher.');
  assert.equal(readJson(path.join(installRoot, 'current/RELEASE.json')).version, '0.0.1');
  const installation = readJson(path.join(installRoot, 'current/INSTALLATION.json'));
  assert.deepEqual(installation, { installRoot, binRoot }, 'The installer did not remain inside the isolated fixture.');
  run(launcher, ['init', storageRoot], environment);
  const created = JSON.parse(run(launcher, ['create', 'update-rehearsal', '--title', 'Update Rehearsal', '--logline', 'Saved before the update.', '--json'], environment));
  const projectBefore = JSON.parse(run(launcher, ['info', 'show', '--project', 'update-rehearsal', '--json'], environment));
  const media = path.join(created.projectPath, 'rehearsal-media.txt');
  writeFileSync(media, 'Media retained across the Studio update.\n');
  const mediaHash = sha256(media);
  offeredVersion = '0.0.2';
  launchTerminal('start-fixture', `/usr/bin/env ${environmentAssignments(environment)} ${shellQuote(launcher)} studio start`);
  const first = await waitForStatus('available', '0.0.1', 30_000);
  assert.equal(first.publishedVersion, '0.0.2');
  const descriptorPath = path.join(home, '.config/renku/studio-runtime.json');
  assert.ok(existsSync(descriptorPath), 'Studio used a different profile; do not continue with the handoff.');
  const oldPid = readJson(descriptorPath).pid;
  console.log('\nIn the browser, open the update indicator and choose Download and update. Complete the skills prompts in the new Terminal window.');
  console.log(`Evidence and request log: ${root}`);
  const updated = await waitForStatus('current', '0.0.2', 300_000);
  assert.equal(updated.publishedVersion, '0.0.2');
  await prompt.question('Confirm the reopened browser shows no update indicator, then press Return here. ');
  const nextPid = readJson(descriptorPath).pid;
  assert.notEqual(nextPid, oldPid, 'The original Studio process is still serving.');
  assert.equal(readJson(path.join(installRoot, 'current/RELEASE.json')).version, '0.0.2');
  assert.ok(readFileSync(launcher, 'utf8').includes(path.join(installRoot, 'versions/0.0.2/runtime/node/bin/node')), 'The launcher does not target the updated runtime.');
  assert.ok(requestLog.some((entry) => entry.path === `/studio/releases/0.0.2/${sourceRelease.target}/renku.tar.gz`), 'No new archive request was observed.');
  const projectAfter = JSON.parse(run(launcher, ['info', 'show', '--project', 'update-rehearsal', '--json'], environment));
  assert.deepEqual(projectAfter.project, projectBefore.project, 'Saved Project information changed.');
  assert.equal(sha256(media), mediaHash, 'Saved media changed.');
  writeJson(path.join(root, 'result.json'), { result: 'passed', oldPid, nextPid, status: updated, mediaHash });
  console.log(`PASS: Studio 0.0.2 is running, the offer cleared, and Project data remains intact. Evidence: ${root}`);
} catch (error) {
  writeJson(path.join(root, 'result.json'), { result: 'failed', message: String(error) });
  console.error(`Rehearsal failed. Evidence: ${root}`);
  throw error;
} finally {
  prompt.close();
  if (existsSync(launcher) && existsSync(path.join(home, '.config/renku/studio-runtime.json'))) {
    try {
      run(launcher, ['studio', 'stop'], environment);
    } catch (error) {
      console.warn(`Could not stop the isolated Studio fixture: ${error}`);
    }
  }
  server.close();
}

function readJson(file) { return JSON.parse(readFileSync(file, 'utf8')); }
function writeJson(file, value) { writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`); }
function sha256(file) { return createHash('sha256').update(readFileSync(file)).digest('hex'); }
function shellQuote(value) { return `'${value.replaceAll("'", "'\\''")}'`; }
function environmentAssignments(environment) {
  return ['HOME', 'ZDOTDIR', 'XDG_CONFIG_HOME', 'FLATPAK_XDG_CONFIG_HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA',
    'CODEX_HOME', 'CLAUDE_CONFIG_DIR', 'VIBE_HOME', 'HERMES_HOME', 'AUTOHAND_HOME', 'GROK_HOME', 'SARVAM_HOME',
    'SHELL', 'PATH', 'RENKU_DOWNLOAD_BASE_URL', 'RENKU_INSTALL_ROOT', 'RENKU_BIN_ROOT']
    .map((name) => `${name}=${shellQuote(environment[name])}`).join(' ');
}
function run(command, arguments_, environment) {
  return execFileSync(command, arguments_, { env: environment, encoding: 'utf8' });
}
function launchTerminal(name, command) {
  const script = path.join(root, `${name}.sh`);
  writeFileSync(script, `#!/bin/sh\nprintf '%s\\n' 'Renku isolated update rehearsal'\n${command}\n`, { mode: 0o700 });
  const appleScript = `tell application "Terminal" to do script ${JSON.stringify(`/bin/sh ${shellQuote(script)}`)}`;
  execFileSync('osascript', ['-e', appleScript], { stdio: 'ignore' });
}
async function portOccupied(port) {
  for (const host of ['127.0.0.1', '::1']) {
    if (await new Promise((resolve) => {
      const socket = net.connect(port, host);
      socket.once('connect', () => { socket.destroy(); resolve(true); });
      socket.once('error', () => { socket.destroy(); resolve(false); });
    })) {
      return true;
    }
  }
  return false;
}
async function waitForStatus(expectedState, expectedInstalled, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const bootstrap = await fetch('http://localhost:5173/studio-api/bootstrap', { headers: { 'X-Renku-Studio-Bootstrap': '1' } });
      const { studioApiToken } = await bootstrap.json();
      const response = await fetch('http://localhost:5173/studio-api/studio/update', { headers: { 'X-Renku-Studio-Token': studioApiToken }, cache: 'no-store' });
      const { status } = await response.json();
      if (status?.state === expectedState && status.installedVersion === expectedInstalled) return status;
    } catch {
      // Studio is expected to be briefly unavailable during the update.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for Studio ${expectedInstalled} update state ${expectedState}.`);
}

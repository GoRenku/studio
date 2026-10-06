import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { coreRoot, fixtureForProduct, releaseIdentity, verifyExtractedArchive } from './upgrades/fixtures.mjs';
import { assertJournalComplete, assertPreserved, observeProject } from './upgrades/preservation.mjs';
import { launchDesktopTerminal, retainWindowsUserPath, runInstalledLauncher } from './upgrades/desktop-terminal.mjs';
import { isolatedEnvironment } from './verify-project-upgrade.mjs';

const args = process.argv.slice(2);
const value = (name) => args[args.indexOf(name) + 1];
if (!['darwin', 'win32'].includes(process.platform) || ['--source-product', '--target-product', '--report'].some((name) => !args.includes(name) || !value(name) || value(name).startsWith('--'))) {
  console.error('Usage (native desktop): verify-studio-update.mjs --source-product <extracted-source> --target-product <extracted-candidate> --report <report.json>');
  process.exit(1);
}
const sourceProduct = path.resolve(value('--source-product'));
const targetProduct = path.resolve(value('--target-product'));
const reportPath = path.resolve(value('--report'));
writeJson(reportPath, { result: 'running', manualAcceptance: 'required' });
const sourceRelease = releaseIdentity(sourceProduct);
const targetRelease = releaseIdentity(targetProduct);
assert.equal(sourceRelease.target, `${process.platform}-${process.arch}`);
assert.equal(targetRelease.target, sourceRelease.target);
assert.notEqual(sourceRelease.version, targetRelease.version, 'Desktop handoff needs genuinely distinct releases');
const fixture = fixtureForProduct(sourceProduct);
const archiveSha256 = verifyExtractedArchive(targetProduct);
assert.ok(existsSync(path.join(sourceProduct, 'app/node_modules/@gorenku/studio/server-dist/routes/studio-update.js')),
  'The assembled product does not contain the Studio update route. Assemble the current build first.');
if (await portOccupied(5173)) throw new Error('Port 5173 is occupied. Stop the existing Studio before running this isolated rehearsal.');

const root = mkdtempSync(path.join(os.tmpdir(), 'studio-update-rehearsal-'));
const host = '127.0.0.1';
const versionKeys = new Map();
const requestLog = [];
let offeredVersion = sourceRelease.version;
let manifest;
for (const product of [sourceProduct, targetProduct]) {
  const release = releaseIdentity(product);
  const receipt = readJson(path.join(path.dirname(product), 'archive.json'));
  versionKeys.set(release.version, receipt);
}
const archiveName = process.platform === 'win32' ? 'renku.zip' : 'renku.tar.gz';

const server = createServer((request, response) => {
  requestLog.push({ at: new Date().toISOString(), path: request.url });
  writeJson(path.join(root, 'request-log.json'), requestLog);
  if (request.url === '/studio/channels/beta/release.json') {
    manifest = {
      product: 'renku', channel: 'beta', version: offeredVersion,
      artifacts: [{
        target: sourceRelease.target,
        versionKey: `studio/releases/${offeredVersion}/${sourceRelease.target}/${archiveName}`,
        sha256: versionKeys.get(offeredVersion).sha256,
      }],
    };
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify(manifest));
    return;
  }
  for (const [version, artifact] of versionKeys) {
    if (request.url === `/studio/releases/${version}/${sourceRelease.target}/${archiveName}`) {
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
  ...isolatedEnvironment(home),
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
  ...(process.platform === 'darwin' ? { SHELL: '/bin/zsh' } : {}),
  RENKU_DOWNLOAD_BASE_URL: downloadBaseUrl,
  RENKU_INSTALL_ROOT: installRoot,
  RENKU_BIN_ROOT: binRoot,
};
const launcher = path.join(binRoot, process.platform === 'win32' ? 'renku.cmd' : 'renku');
const descriptorPath = process.platform === 'win32' ? path.join(environment.LOCALAPPDATA, 'Renku/Studio/studio-runtime.json') : path.join(home, '.config/renku/studio-runtime.json');
const installedProduct = () => process.platform === 'win32' ? readFileSync(path.join(installRoot, 'current.txt'), 'utf8').trim() : path.join(installRoot, 'current');
const prompt = createInterface({ input: process.stdin, output: process.stdout });
const restoreUserPath = retainWindowsUserPath(binRoot);
try {
  const installer = path.join(sourceProduct, 'distribution', process.platform === 'win32' ? 'install.ps1' : 'install.sh');
  launchDesktopTerminal(root, 'install-fixture', process.platform === 'win32' ? 'powershell.exe' : '/bin/sh',
    process.platform === 'win32' ? ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', installer] : [installer], environment);
  console.log(`\nIsolated rehearsal: ${root}`);
  await prompt.question('Complete the installer and skills prompts in Terminal, then press Return here. ');
  assert.ok(existsSync(launcher), 'The isolated installer did not create its launcher.');
  assert.equal(readJson(path.join(installedProduct(), 'RELEASE.json')).version, sourceRelease.version);
  const installation = readJson(path.join(installedProduct(), 'INSTALLATION.json'));
  assert.deepEqual(installation, { installRoot, binRoot }, 'The installer did not remain inside the isolated fixture.');
  run(launcher, ['init', storageRoot], environment);
  const created = JSON.parse(run(launcher, ['create', 'upgrade-fixture', '--title', 'Update Rehearsal', '--logline', 'Saved before the update.', '--json'], environment));
  const sourceNode = path.join(sourceProduct, 'runtime/node', process.platform === 'win32' ? 'node.exe' : 'bin/node');
  const recipeUrl = new URL('./upgrades/recipe.mjs', import.meta.url).href;
  execFileSync(sourceNode, ['--input-type=module', '--eval', `import { populateProject } from ${JSON.stringify(recipeUrl)}; await populateProject(...${JSON.stringify([sourceProduct, created.projectPath, fixture.schemaGeneration])});`], { env: environment, cwd: root });
  if (fixture.schemaGeneration >= 71) {
    execFileSync(sourceNode, ['--input-type=module', '--eval', `
      import {createRequire} from 'node:module';
      const Database = createRequire(${JSON.stringify(path.join(coreRoot(sourceProduct), 'package.json'))})('better-sqlite3');
      const db = new Database(${JSON.stringify(path.join(created.projectPath, '.renku/project.sqlite'))});
      db.prepare('update project set asset_file_backfill_version = 0').run(); db.close();
    `], { env: environment, cwd: root });
  }
  const before = observeProject(sourceProduct, created.projectPath);
  const blockedDestination = path.join(created.projectPath, '.renku/project-database-backups');
  writeFileSync(blockedDestination, 'Synthetic backup-failure evidence');
  offeredVersion = targetRelease.version;
  launchDesktopTerminal(root, 'start-fixture', launcher, ['studio', 'start'], environment);
  const first = await waitForStatus('available', sourceRelease.version, 30_000);
  assert.equal(first.publishedVersion, targetRelease.version);
  assert.ok(existsSync(descriptorPath), 'Studio used a different profile; do not continue with the handoff.');
  const oldPid = readJson(descriptorPath).pid;
  console.log('\nIn the browser, open the update indicator and choose Download and update. Complete the skills prompts in the new Terminal window.');
  console.log(`Evidence and request log: ${root}`);
  const updated = await waitForStatus('current', targetRelease.version, 300_000);
  assert.equal(updated.publishedVersion, targetRelease.version);
  const failedOpen = await fetch('http://localhost:5173/studio-api/projects/upgrade-fixture');
  assert.ok(!failedOpen.ok, 'A blocked backup unexpectedly allowed Project readiness');
  const failure = await failedOpen.json();
  assert.equal(failure.error.code, 'PROJECT_DATA046');
  assert.ok(failure.error.issues?.length > 0, 'The browser response lost the Core operation diagnostics');
  assert.deepEqual(observeProject(sourceProduct, created.projectPath).tables, before.tables, 'Failed backup allowed upgrade writes');
  await prompt.question('Open the saved Project and confirm the backup error is understandable. Press Return after checking it. ');
  renameSync(blockedDestination, path.join(root, 'blocked-backup-destination.fixture'));
  const retried = await fetch('http://localhost:5173/studio-api/projects/upgrade-fixture');
  assert.ok(retried.ok, `Project did not recover after fixing the backup destination: ${await retried.text()}`);
  await prompt.question('Confirm the reopened browser shows no update indicator and the saved Project is visible. Also check a second tab and close/reopen the first tab during handoff. Press Return only after those checks pass. ');
  const nextPid = readJson(descriptorPath).pid;
  assert.notEqual(nextPid, oldPid, 'The original Studio process is still serving.');
  assert.throws(() => process.kill(oldPid, 0), 'The original Studio process did not exit');
  assert.equal(readJson(path.join(installedProduct(), 'RELEASE.json')).version, targetRelease.version);
  const launcherScript = process.platform === 'win32' ? path.join(binRoot, 'renku-launch.ps1') : launcher;
  assert.ok(readFileSync(launcherScript, 'utf8').includes(path.join(installRoot, 'versions', targetRelease.version)), 'The launcher does not target the updated runtime.');
  assert.ok(requestLog.some((entry) => entry.path === `/studio/releases/${targetRelease.version}/${sourceRelease.target}/${archiveName}`), 'No new archive request was observed.');
  run(launcher, ['info', 'show', '--project', 'upgrade-fixture', '--json'], environment);
  const after = observeProject(targetProduct, created.projectPath);
  assertJournalComplete(targetProduct, after);
  assertPreserved(before, after);
  for (const file of after.tables.asset_file.filter((file) => file.discarded_at === null && ['image', 'audio', 'video'].includes(file.media_kind))) {
    const response = await fetch(`http://localhost:5173/studio-api/projects/upgrade-fixture/asset-files/${encodeURIComponent(file.id)}`);
    assert.ok(response.ok, 'Updated Studio did not serve saved media');
    assert.equal(createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex'), file.content_hash);
  }
  run(launcher, ['info', 'show', '--project', 'upgrade-fixture', '--json'], environment);
  assert.deepEqual(observeProject(targetProduct, created.projectPath), after, 'Repeat open changed saved work');
  writeJson(reportPath, { result: 'passed', manualAcceptance: 'passed', target: targetRelease.target,
    sourceVersion: sourceRelease.version, version: targetRelease.version, sourceArchiveSha256: fixture.archiveSha256,
    archiveSha256, oldPid, nextPid, status: updated, evidenceRoot: root, verifiedAt: new Date().toISOString() });
  console.log(`PASS: Studio ${targetRelease.version} is running, the offer cleared, and Project data remains intact. Evidence: ${root}`);
} catch (error) {
  writeJson(reportPath, { result: 'failed', evidenceRoot: root, message: String(error) });
  console.error(`Rehearsal failed. Evidence: ${root}`);
  throw error;
} finally {
  prompt.close();
  if (existsSync(launcher) && existsSync(descriptorPath)) {
    try {
      run(launcher, ['studio', 'stop'], environment);
    } catch (error) {
      console.warn(`Could not stop the isolated Studio fixture: ${error}`);
    }
  }
  server.close();
  restoreUserPath();
}

function readJson(file) { return JSON.parse(readFileSync(file, 'utf8')); }
function writeJson(file, value) { writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`); }
function run(command, arguments_, environment) {
  return runInstalledLauncher(command, arguments_, environment);
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

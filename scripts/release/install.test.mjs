import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const installer = fileURLToPath(new URL('../../distribution/install.sh', import.meta.url));

function fixture({ missingGit = false, gitSetupFails = false, skillsExit = 0, cliExit = 0, badChecksum = false, manifestArtifact = {}, updateScope, installedVersion = '0.0.1' } = {}) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'renku-installer-'));
  const product = path.join(root, 'archive', 'renku');
  const bin = path.join(root, 'commands');
  mkdirSync(bin);
  mkdirSync(path.join(product, 'app', 'dist'), { recursive: true });
  mkdirSync(path.join(product, 'app', 'node_modules', 'skills', 'bin'), { recursive: true });
  mkdirSync(path.join(product, 'runtime', 'node', 'bin'), { recursive: true });
  writeFileSync(path.join(product, 'RELEASE.json'), '{"version": "0.0.1", "target": "darwin-arm64"}\n');
  writeFileSync(path.join(product, 'app', 'dist', 'cli.js'), '');
  writeFileSync(path.join(product, 'app', 'node_modules', 'skills', 'bin', 'cli.mjs'), '');
  const executable = (file, body) => writeFileSync(file, `#!/bin/sh\n${body}\n`, { mode: 0o755 });
  executable(path.join(product, 'runtime', 'node', 'bin', 'node'), `
case "$1" in
  --input-type=commonjs) exec "$TEST_NODE" "$@" ;;
  */cli.js) exit ${cliExit} ;;
  */skills/bin/cli.mjs)
    [ "$2" != --version ] || exit 0
    [ -t 0 ] || exit 71
    printf '%s\\n' "$@" > "$TEST_ROOT/skills-args"
    command -v node > "$TEST_ROOT/selected-node"
    [ ! -f "$TEST_ROOT/skills-retry" ] || exit 0
    exit ${skillsExit} ;;
esac
exit 72`);
  executable(path.join(bin, 'node'), 'exit 73');
  // uname -m must report the released architecture.
  executable(path.join(bin, 'uname'), '[ "$1" = -m ] && echo arm64 || echo Darwin');
  executable(path.join(bin, 'git'), missingGit ? '[ -f "$TEST_ROOT/git-ready" ]' : 'exit 0');
  executable(path.join(bin, 'xcode-select'), gitSetupFails ? 'exit 1' : 'touch "$TEST_ROOT/git-ready"');
  const archive = path.join(root, 'renku.tar.gz');
  assert.equal(spawnSync('tar', ['-czf', archive, '-C', path.join(root, 'archive'), 'renku']).status, 0);
  const checksum = createHash('sha256').update(readFileSync(archive)).digest('hex');
  writeFileSync(path.join(root, 'release.json'), JSON.stringify({
    version: '0.0.1',
    artifacts: [
      { target: 'win32-x64' },
      {
        target: 'darwin-arm64',
        versionKey: 'studio/releases/0.0.1/darwin-arm64/renku.tar.gz',
        sha256: badChecksum ? '0'.repeat(64) : checksum,
        ...manifestArtifact,
      },
    ],
  }));
  executable(path.join(bin, 'curl'), `
touch "$TEST_ROOT/downloaded"
printf '%s\\n' "$2" >> "$TEST_ROOT/download-urls"
case "$2" in
  */studio/channels/beta/release.json) cp "$TEST_ROOT/release.json" "$4" ;;
  */studio/releases/0.0.1/darwin-arm64/renku.tar.gz) cp "$TEST_ROOT/renku.tar.gz" "$4" ;;
  *) exit 74 ;;
esac`);
  const env = {
    ...process.env,
    HOME: root,
    SHELL: '/bin/sh',
    PATH: `${bin}:/usr/bin:/bin`,
    TEST_ROOT: root,
    TEST_NODE: process.execPath,
    RENKU_INSTALL_ROOT: path.join(root, 'Renku with spaces'),
    RENKU_BIN_ROOT: path.join(root, 'launchers'),
  };
  if (updateScope) {
    const installed = path.join(env.RENKU_INSTALL_ROOT, 'versions', installedVersion);
    cpSync(product, installed, { recursive: true });
    writeFileSync(path.join(installed, 'retained-marker'), 'keep');
    env.RENKU_UPDATE_SCOPE = updateScope;
    env.RENKU_INSTALLED_PRODUCT = installed;
  }
  return { root, env };
}

function runInstaller(options) {
  return executeInstaller(fixture(options));
}

function executeInstaller(setup, shellCommand = 'cat "$INSTALLER" | /bin/sh') {
  // Give prompts a controlling terminal while sh reads its program from a pipe.
  const result = spawnSync('python3', ['-c', `
import errno, os, pty, sys
pid, fd = pty.fork()
if pid == 0:
    os.execv('/bin/sh', ['sh', '-c', os.environ['INSTALL_COMMAND']])
os.write(fd, b'\\n')
while True:
    try:
        data = os.read(fd, 65536)
        if not data: break
        sys.stdout.buffer.write(data)
    except OSError as error:
        if error.errno != errno.EIO: raise
        break
_, status = os.waitpid(pid, 0)
sys.exit(os.waitstatus_to_exitcode(status))
`], {
    env: { ...setup.env, INSTALLER: installer, INSTALL_COMMAND: shellCommand }, encoding: 'utf8', timeout: 15000,
  });
  assert.ifError(result.error);
  return { ...setup, result, output: result.stdout + result.stderr };
}

test('macOS piped installer uses private Node and passes interactive agent selection', { skip: process.platform !== 'darwin' }, () => {
  const { root, output } = runInstaller();
  assert.match(output, /Restart your agent/);
  assert.deepEqual(readFileSync(path.join(root, 'skills-args'), 'utf8').trim().split('\n').slice(1), [
    'add', 'GoRenku/studio-skills', '--global', '--skill', '*', '--copy',
  ]);
  assert.equal(readFileSync(path.join(root, 'selected-node'), 'utf8').trim(), path.join(root, 'Renku with spaces', 'versions', '0.0.1', 'runtime', 'node', 'bin', 'node'));
});

test('macOS bootstrap makes renku available in the same parent shell', { skip: process.platform !== 'darwin' }, () => {
  const setup = fixture();
  setup.env.RENKU_BIN_ROOT = path.join(setup.root, '.local', 'bin');
  const { result, output } = executeInstaller(setup, 'cat "$INSTALLER" | /bin/sh && export PATH="$HOME/.local/bin:$PATH" && renku about');
  assert.equal(result.status, 0, output);
});

test('printed macOS launch command runs with a custom path containing spaces', { skip: process.platform !== 'darwin' }, () => {
  const setup = fixture();
  setup.env.RENKU_BIN_ROOT = path.join(setup.root, 'Renku launchers');
  const { result, output } = executeInstaller(setup);
  assert.equal(result.status, 0, output);
  const command = output.match(/^Start Studio: (.+)$/m)?.[1].trim();
  assert.ok(command, output);
  assert.equal(spawnSync('/bin/sh', ['-c', command], { env: setup.env }).status, 0);
});

test('skills-only update uses the installed runtime without downloading an archive', { skip: process.platform !== 'darwin' }, () => {
  const { root, env, result, output } = runInstaller({ updateScope: 'skills', badChecksum: true });
  assert.equal(result.status, 0, output);
  assert.equal(existsSync(path.join(root, 'downloaded')), false);
  assert.equal(readFileSync(path.join(env.RENKU_INSTALLED_PRODUCT, 'retained-marker'), 'utf8'), 'keep');
  assert.match(readFileSync(path.join(root, 'skills-args'), 'utf8'), /GoRenku\/studio-skills/);
});

test('updating the current version preserves the running runtime and custom locations', { skip: process.platform !== 'darwin' }, () => {
  const { env, result, output } = runInstaller({ updateScope: 'all' });
  assert.equal(result.status, 0, output);
  assert.equal(readFileSync(path.join(env.RENKU_INSTALLED_PRODUCT, 'retained-marker'), 'utf8'), 'keep');
  assert.deepEqual(JSON.parse(readFileSync(path.join(env.RENKU_INSTALLED_PRODUCT, 'INSTALLATION.json'), 'utf8')), {
    installRoot: env.RENKU_INSTALL_ROOT, binRoot: env.RENKU_BIN_ROOT,
  });
});

test('full update activates the new runtime, retains the previous version, and installs skills', { skip: process.platform !== 'darwin' }, () => {
  const { root, env, result, output } = runInstaller({ updateScope: 'all', installedVersion: '0.0.0' });
  assert.equal(result.status, 0, output);
  assert.equal(readFileSync(path.join(env.RENKU_INSTALLED_PRODUCT, 'retained-marker'), 'utf8'), 'keep');
  assert.match(readFileSync(path.join(env.RENKU_BIN_ROOT, 'renku'), 'utf8'), /versions\/0\.0\.1/);
  assert.ok(existsSync(path.join(root, 'skills-args')));
});

test('macOS installer initiates missing Git setup before installing skills', { skip: process.platform !== 'darwin' }, () => {
  const { root, output } = runInstaller({ missingGit: true });
  assert.match(output, /Opening Apple Command Line Tools/);
  assert.match(output, /Restart your agent/);
  assert.ok(readFileSync(path.join(root, 'skills-args'), 'utf8'));
});

test('skills failure leaves an installed runtime and reports a retry', { skip: process.platform !== 'darwin' }, () => {
  const { root, output } = runInstaller({ skillsExit: 1 });
  assert.match(output, /INSTALL009/);
  assert.doesNotMatch(output, /Restart your agent/);
  assert.equal(spawnSync(path.join(root, 'launchers', 'renku'), ['about']).status, 0);
});

test('archive checksum failure stops before installing skills', { skip: process.platform !== 'darwin' }, () => {
  const { output } = runInstaller({ badChecksum: true });
  assert.match(output, /INSTALL003/);
  assert.doesNotMatch(output, /Choose the agents/);
});

for (const skillsExit of [0, 1]) {
  test(`rerunning after skills exit ${skillsExit} reuses the runtime and repeats agent selection`, { skip: process.platform !== 'darwin' }, () => {
    const first = runInstaller({ skillsExit });
    const installed = path.join(first.env.RENKU_INSTALL_ROOT, 'versions', '0.0.1');
    writeFileSync(path.join(installed, 'retained-marker'), 'keep');
    writeFileSync(path.join(first.root, 'download-urls'), '');
    writeFileSync(path.join(first.root, 'skills-args'), '');
    writeFileSync(path.join(first.root, 'skills-retry'), '');
    const retry = executeInstaller(first);
    assert.equal(retry.result.status, 0, retry.output);
    assert.match(retry.output, /Skipping download/);
    assert.equal(readFileSync(path.join(installed, 'retained-marker'), 'utf8'), 'keep');
    assert.equal(readFileSync(path.join(first.root, 'download-urls'), 'utf8').trim(), 'https://downloads.gorenku.com/studio/channels/beta/release.json');
    assert.match(readFileSync(path.join(first.root, 'skills-args'), 'utf8'), /GoRenku\/studio-skills/);
  });
}

test('an installed runtime that cannot run is downloaded and repaired', { skip: process.platform !== 'darwin' }, () => {
  const first = runInstaller();
  const installed = path.join(first.env.RENKU_INSTALL_ROOT, 'versions', '0.0.1');
  writeFileSync(path.join(installed, 'runtime', 'node', 'bin', 'node'), '#!/bin/sh\nexit 1\n');
  writeFileSync(path.join(first.root, 'download-urls'), '');
  const retry = executeInstaller(first);
  assert.equal(retry.result.status, 0, retry.output);
  assert.match(readFileSync(path.join(first.root, 'download-urls'), 'utf8'), /studio\/releases\/0.0.1/);
  assert.equal(spawnSync(path.join(first.env.RENKU_BIN_ROOT, 'renku'), ['about']).status, 0);
});

test('a downloaded runtime that cannot run is never activated', { skip: process.platform !== 'darwin' }, () => {
  const { env, result, output } = runInstaller({ cliExit: 1 });
  assert.notEqual(result.status, 0);
  assert.match(output, /INSTALL004/);
  assert.equal(existsSync(path.join(env.RENKU_INSTALL_ROOT, 'versions', '0.0.1')), false);
  assert.equal(existsSync(path.join(env.RENKU_BIN_ROOT, 'renku')), false);
});

test('installer selects its manifest artifact and downloads only the immutable archive', { skip: process.platform !== 'darwin' }, () => {
  const { root, result, output } = runInstaller();
  assert.equal(result.status, 0, output);
  assert.deepEqual(readFileSync(path.join(root, 'download-urls'), 'utf8').trim().split('\n'), [
    'https://downloads.gorenku.com/studio/channels/beta/release.json',
    'https://downloads.gorenku.com/studio/releases/0.0.1/darwin-arm64/renku.tar.gz',
  ]);
});

for (const manifestArtifact of [
  { target: 'darwin-x64' },
  { versionKey: 'studio/channels/beta/darwin-arm64/renku.tar.gz' },
  { sha256: 'invalid' },
]) {
  test(`installer rejects invalid manifest artifact ${JSON.stringify(manifestArtifact)}`, { skip: process.platform !== 'darwin' }, () => {
    const { root, result, output } = runInstaller({ manifestArtifact });
    assert.notEqual(result.status, 0);
    assert.match(output, /INSTALL002/);
    assert.equal(readFileSync(path.join(root, 'download-urls'), 'utf8').trim().split('\n').length, 1);
    assert.equal(existsSync(path.join(root, 'skills-args')), false);
  });
}

test('failed Apple tools setup stops before agent selection', { skip: process.platform !== 'darwin' }, () => {
  const { output } = runInstaller({ missingGit: true, gitSetupFails: true });
  assert.match(output, /INSTALL008/);
  assert.doesNotMatch(output, /Choose the agents/);
});

test('installer without a controlling terminal reports how to finish setup', { skip: process.platform !== 'darwin' }, () => {
  const { env } = fixture();
  const result = spawnSync('python3', ['-c', `
import os, subprocess, sys
result = subprocess.run(['/bin/sh', os.environ['INSTALLER']], start_new_session=True)
sys.exit(result.returncode)
`], { env: { ...env, INSTALLER: installer }, encoding: 'utf8', timeout: 15000 });
  assert.equal(result.status, 1);
  assert.match(result.stdout + result.stderr, /INSTALL007/);
});

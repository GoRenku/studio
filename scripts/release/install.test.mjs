import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const installer = fileURLToPath(new URL('../../distribution/install.sh', import.meta.url));

function fixture({ missingGit = false, gitSetupFails = false, skillsExit = 0, badChecksum = false } = {}) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'renku-installer-'));
  const product = path.join(root, 'archive', 'renku');
  const bin = path.join(root, 'commands');
  mkdirSync(bin);
  mkdirSync(path.join(product, 'app', 'dist'), { recursive: true });
  mkdirSync(path.join(product, 'runtime', 'node', 'lib', 'node_modules', 'npm', 'bin'), { recursive: true });
  mkdirSync(path.join(product, 'runtime', 'node', 'bin'), { recursive: true });
  writeFileSync(path.join(product, 'RELEASE.json'), '{"version": "0.0.1"}\n');
  writeFileSync(path.join(product, 'app', 'dist', 'cli.js'), '');
  writeFileSync(path.join(product, 'runtime', 'node', 'lib', 'node_modules', 'npm', 'bin', 'npx-cli.js'), '');
  const executable = (file, body) => writeFileSync(file, `#!/bin/sh\n${body}\n`, { mode: 0o755 });
  executable(path.join(product, 'runtime', 'node', 'bin', 'node'), `
case "$1" in
  */cli.js) exit 0 ;;
  */npx-cli.js)
    [ -t 0 ] || exit 71
    printf '%s\\n' "$@" > "$TEST_ROOT/skills-args"
    command -v node > "$TEST_ROOT/selected-node"
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
  writeFileSync(`${archive}.sha256`, `${badChecksum ? '0'.repeat(64) : checksum}  renku.tar.gz\n`);
  executable(path.join(bin, 'curl'), `
case "$2" in
  *.sha256) cp "$TEST_ROOT/renku.tar.gz.sha256" "$4" ;;
  *) cp "$TEST_ROOT/renku.tar.gz" "$4" ;;
esac`);
  const env = {
    ...process.env,
    HOME: root,
    SHELL: '/bin/sh',
    PATH: `${bin}:/usr/bin:/bin`,
    TEST_ROOT: root,
    RENKU_INSTALL_ROOT: path.join(root, 'Renku with spaces'),
    RENKU_BIN_ROOT: path.join(root, 'launchers'),
  };
  return { root, env };
}

function runInstaller(options) {
  const setup = fixture(options);
  // Give prompts a controlling terminal while sh reads its program from a pipe.
  const result = spawnSync('python3', ['-c', `
import errno, os, pty, sys
pid, fd = pty.fork()
if pid == 0:
    os.execv('/bin/sh', ['sh', '-c', 'cat "$INSTALLER" | /bin/sh'])
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
    env: { ...setup.env, INSTALLER: installer }, encoding: 'utf8', timeout: 15000,
  });
  assert.ifError(result.error);
  return { ...setup, result, output: result.stdout + result.stderr };
}

test('macOS piped installer uses private Node and passes interactive agent selection', { skip: process.platform !== 'darwin' }, () => {
  const { root, output } = runInstaller();
  assert.match(output, /Restart your agent/);
  assert.deepEqual(readFileSync(path.join(root, 'skills-args'), 'utf8').trim().split('\n').slice(1), [
    '--yes', 'skills', 'add', 'GoRenku/studio-skills', '--global', '--skill', '*', '--copy',
  ]);
  assert.equal(readFileSync(path.join(root, 'selected-node'), 'utf8').trim(), path.join(root, 'Renku with spaces', 'versions', '0.0.1', 'runtime', 'node', 'bin', 'node'));
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

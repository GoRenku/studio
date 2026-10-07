import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const cli = fileURLToPath(new URL('../../packages/cli/node_modules/skills/bin/cli.mjs', import.meta.url));

function fixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'renku-picker-'));
  const source = path.join(root, 'source');
  const home = path.join(root, 'home');
  mkdirSync(source);
  mkdirSync(home);
  writeFileSync(path.join(source, 'SKILL.md'), '---\nname: exclusion-fixture\ndescription: Local installer test.\n---\nTest skill.\n');
  const env = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, HOME: home, USERPROFILE: home, APPDATA: path.join(home, 'AppData/Roaming'), LOCALAPPDATA: path.join(home, 'AppData/Local'), XDG_CONFIG_HOME: path.join(home, '.config'), XDG_STATE_HOME: path.join(home, '.local/state'), CLAUDE_CONFIG_DIR: path.join(home, '.claude'), CODEX_HOME: path.join(home, '.codex'), DISABLE_TELEMETRY: '1', DO_NOT_TRACK: '1' };
  const run = (args) => spawnSync(process.execPath, [cli, 'add', source, '--global', '--skill', '*', '--copy', ...args], { env, cwd: home, encoding: 'utf8', timeout: 30000 });
  const installed = (directory) => existsSync(path.join(home, directory, 'skills/exclusion-fixture/SKILL.md'));
  return { run, installed, home, env, source };
}

test('exclusion preserves another explicitly selected harness and option-absent behavior', () => {
  for (const exclude of [true, false]) {
    const { run, installed } = fixture();
    const result = run(['--agent', 'claude-code', 'cursor', '--yes', ...(exclude ? ['--exclude-agent', 'claude-code'] : [])]);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.equal(installed('.claude'), !exclude);
    assert.equal(installed('.agents'), true);
  }
});

test('explicit selection entirely excluded does not expand to other agents', () => {
  const { run, installed } = fixture();
  const result = run(['--agent', 'claude-code', '--exclude-agent', 'claude-code', '--yes']);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /No agents remain/);
  assert.equal(installed('.claude'), false);
  assert.equal(installed('.agents'), false);
});

test('wildcard selection respects exclusions', () => {
  const { run, installed } = fixture();
  const result = run(['--agent', '*', '--exclude-agent', 'claude-code', '--yes']);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(installed('.claude'), false);
  assert.equal(installed('.agents'), true);
});

test('automatic selection filters detected Claude and retains a detected Cursor', () => {
  const { run, installed, home } = fixture();
  mkdirSync(path.join(home, '.claude'));
  mkdirSync(path.join(home, '.cursor'));
  const result = run(['--exclude-agent', 'claude-code', '--yes']);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(installed('.claude'), false);
  assert.equal(installed('.agents'), true);
});

test('automatic selection with only excluded Claude does not install everywhere', () => {
  const { run, installed, home } = fixture();
  mkdirSync(path.join(home, '.claude'));
  const result = run(['--exclude-agent', 'claude-code', '--yes']);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /No agents remain/);
  assert.equal(installed('.claude'), false);
  assert.equal(installed('.agents'), false);
});

test('invalid and missing exclusions fail without copying', () => {
  for (const exclusions of [['missing-harness'], []]) {
    const { run, installed } = fixture();
    const result = run(['--agent', 'claude-code', '--yes', '--exclude-agent', ...exclusions]);
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.equal(installed('.claude'), false);
  }
});

test('saved Claude preselection is excluded from the interactive picker; cancellation copies nothing', { skip: process.platform !== 'darwin' }, () => {
  const { home, env, source, installed } = fixture();
  mkdirSync(path.join(env.XDG_STATE_HOME, 'skills'), { recursive: true });
  writeFileSync(path.join(env.XDG_STATE_HOME, 'skills/.skill-lock.json'), JSON.stringify({ version: 3, skills: {}, lastSelectedAgents: ['claude-code', 'cursor'] }));
  mkdirSync(path.join(home, '.claude'));
  mkdirSync(path.join(home, '.cursor'));
  mkdirSync(path.join(home, '.codex'));
  const program = `import os, pty, select, signal, sys, time
pid, fd = pty.fork()
if pid == 0:
    os.execve(sys.argv[1], sys.argv[1:], dict(os.environ))
output = b''
deadline = time.time() + 20
while time.time() < deadline:
    if select.select([fd], [], [], 0.2)[0]:
        try: chunk = os.read(fd, 65536)
        except OSError: break
        if not chunk: break
        output += chunk
        if b'Which agents' in output:
            os.write(fd, b'\\x03')
            break
sys.stdout.buffer.write(output)
sys.stdout.flush()
os.kill(pid, signal.SIGTERM)
os.waitpid(pid, 0)
`;
  const result = spawnSync('/usr/bin/python3', ['-c', program, process.execPath, cli, 'add', source, '--global', '--skill', '*', '--copy', '--exclude-agent', 'claude-code'], { cwd: home, env, encoding: 'utf8', timeout: 30000 });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /Which agents/);
  assert.doesNotMatch(result.stdout, /Claude Code/);
  assert.equal(installed('.claude'), false);
  assert.equal(installed('.agents'), false);
});

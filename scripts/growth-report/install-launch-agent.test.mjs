import assert from 'node:assert/strict';
import test from 'node:test';
import { installLaunchAgent } from './install-launch-agent.mjs';

function harness({ platform = 'darwin', envExists = true, bootout = 0, bootstrap = 0 } = {}) {
  const writes = [];
  const commands = [];
  let output = '';
  const options = {
    platform,
    homeDirectory: '/Users/maintainer',
    repositoryRoot: '/Users/maintainer/Projects/studio',
    nodePath: '/usr/local/bin/node',
    uid: 501,
    fileExists: (filePath) => envExists && filePath === '/Users/maintainer/Projects/studio/.env',
    writeFile: (filePath, contents) => writes.push({ filePath, contents }),
    runCommand: (command, args) => {
      commands.push([command, ...args]);
      const status = args[0] === 'bootout' ? bootout : bootstrap;
      return { status, stdout: '', stderr: status ? 'Bootstrap failed: 5: Input/output error' : '' };
    },
    stdout: { write: (text) => { output += text; } },
  };
  return { options, writes, commands, output: () => output };
}

function failure(options) {
  try {
    installLaunchAgent(options);
  } catch (error) {
    return error;
  }
  assert.fail('expected a failure');
}

test('writes the agent and reloads it for the current user', () => {
  const h = harness({ bootout: 3 });
  installLaunchAgent(h.options);
  assert.equal(h.writes.length, 1);
  assert.equal(h.writes[0].filePath, '/Users/maintainer/Library/LaunchAgents/com.gorenku.growth-report.plist');
  assert.match(h.writes[0].contents, /--env-file=\/Users\/maintainer\/Projects\/studio\/\.env/);
  assert.deepEqual(h.commands, [
    ['launchctl', 'bootout', 'gui/501/com.gorenku.growth-report'],
    ['launchctl', 'bootstrap', 'gui/501', '/Users/maintainer/Library/LaunchAgents/com.gorenku.growth-report.plist'],
  ]);
  assert.match(h.output(), /daily at 09:17 local time/);
  assert.match(h.output(), /Log: \/Users\/maintainer\/Library\/Logs\/renku-growth-report\.log/);
});

test('other platforms and a missing .env stop before anything is written', () => {
  for (const h of [harness({ platform: 'linux' }), harness({ envExists: false })]) {
    const error = failure(h.options);
    assert.equal(error.code, 'GROWTH009');
    assert.equal(h.writes.length, 0);
    assert.equal(h.commands.length, 0);
  }
});

test('a failing bootstrap reports launchctl output', () => {
  const h = harness({ bootstrap: 5 });
  const error = failure(h.options);
  assert.equal(error.code, 'GROWTH009');
  assert.match(error.message, /exited with 5: Bootstrap failed/);
});
